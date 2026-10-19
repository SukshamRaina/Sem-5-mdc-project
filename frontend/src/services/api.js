/**
 * Dedicated API Service Layer for NASA C-MAPSS Predictive Maintenance Backend.
 * Strictly adheres to FastAPI Phase 2 request and response contracts.
 */

export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // Default to relative root (leverages Vite dev proxy) or direct backend
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

class ApiError extends Error {
  constructor(message, status = null, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Parses and formats error responses from FastAPI (such as Pydantic 422 or domain exceptions).
 */
async function parseErrorResponse(response) {
  let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
  let errorDetail = null;

  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (typeof data.detail === 'string') {
        errorMessage = data.detail;
        errorDetail = data.detail;
      } else if (Array.isArray(data.detail)) {
        // Pydantic validation errors array
        errorMessage = data.detail
          .map((err) => `${err.loc?.join('.')} : ${err.msg}`)
          .join('; ');
        errorDetail = data.detail;
      } else if (data.message) {
        errorMessage = data.message;
        errorDetail = data;
      } else if (data.error) {
        errorMessage = data.error;
        errorDetail = data;
      }
    } else {
      const text = await response.text();
      if (text) errorMessage = text.slice(0, 300);
    }
  } catch {
    // Keep fallback message
  }

  return new ApiError(errorMessage, response.status, errorDetail);
}

/**
 * Fetch health status of the backend API, ML model in-memory state, and Supabase connectivity.
 */
export async function getHealth() {
  try {
    const targetUrl = API_BASE_URL ? `${API_BASE_URL}/health` : '/health';
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const location = API_BASE_URL || window?.location?.origin || 'http://127.0.0.1:8000';
    throw new ApiError(
      `Unable to reach backend at ${location}. Ensure FastAPI service is running.`,
      0,
      error
    );
  }
}

/**
 * Uploads a CSV file to the real POST /predict endpoint.
 * Supports XMLHttpRequest for granular upload progress tracking.
 */
export function predictFromCsv(file, includeTrajectory = true, onProgress = null) {
  return new Promise((resolve, reject) => {
    // Client-side file type and size validation
    if (!file) {
      return reject(new ApiError('No file selected for prediction.', 400));
    }

    const fileName = (file.name || '').toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
      return reject(
        new ApiError(
          `Invalid file format ("${file.name}"). Only .csv and NASA C-MAPSS .txt files are supported.`,
          400
        )
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return reject(
        new ApiError(
          `File size exceeds maximum allowable limit of 10 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
          413
        )
      );
    }

    if (file.size === 0) {
      return reject(
        new ApiError('Selected file is empty (0 bytes). Please select a valid telemetry file.', 400)
      );
    }

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    const endpoint = API_BASE_URL ? `${API_BASE_URL}/predict` : '/predict';
    const url = `${endpoint}?include_trajectory=${encodeURIComponent(includeTrajectory)}`;

    xhr.open('POST', url);
    xhr.setRequestHeader('Accept', 'application/json');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      try {
        const responseData = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(responseData);
        } else {
          const detail =
            responseData.detail ||
            responseData.error ||
            responseData.message ||
            `Server returned status ${xhr.status}`;
          const formattedDetail =
            typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
          reject(new ApiError(formattedDetail, xhr.status, responseData));
        }
      } catch (err) {
        reject(
          new ApiError(
            `Failed to parse server response: ${err.message}`,
            xhr.status
          )
        );
      }
    };

    xhr.onerror = () => {
      const location = API_BASE_URL || window?.location?.origin || 'http://127.0.0.1:8000';
      reject(
        new ApiError(
          `Network connection error communicating with FastAPI backend at ${location}.`,
          0
        )
      );
    };

    xhr.ontimeout = () => {
      reject(new ApiError('Inference request timed out. Please try again.', 408));
    };

    xhr.timeout = 60000; // 60 seconds
    xhr.send(formData);
  });
}

/**
 * Predict RUL from raw CSV text payload (POST /predict/raw).
 */
export async function predictFromRawCsv(csvData, includeTrajectory = true) {
  try {
    const targetUrl = API_BASE_URL ? `${API_BASE_URL}/predict/raw` : '/predict/raw';
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        csv_data: csvData,
        include_trajectory: includeTrajectory,
      }),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Network request failed: ${error.message}`, 0, error);
  }
}

/**
 * Fetch paginated prediction history from Supabase / in-memory database.
 */
export async function getPredictions({
  page = 1,
  pageSize = 20,
  engineId = null,
  riskLevel = null,
} = {}) {
  try {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));

    if (engineId !== null && engineId !== undefined && engineId !== '') {
      params.set('engine_id', String(engineId));
    }
    if (riskLevel && riskLevel !== 'ALL') {
      params.set('risk_level', String(riskLevel).toUpperCase());
    }

    const endpoint = API_BASE_URL ? `${API_BASE_URL}/predictions` : '/predictions';
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Failed to fetch prediction history: ${error.message}`, 0, error);
  }
}

/**
 * Fetch a single prediction record by ID.
 */
export async function getPredictionById(predictionId) {
  try {
    const endpoint = API_BASE_URL
      ? `${API_BASE_URL}/predictions/${encodeURIComponent(predictionId)}`
      : `/predictions/${encodeURIComponent(predictionId)}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Failed to fetch prediction record: ${error.message}`, 0, error);
  }
}

export { ApiError };
