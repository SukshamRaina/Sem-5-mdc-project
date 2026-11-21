# Physics-Informed Neural Network (PINN) Formulation for Turbofan Remaining Useful Life

## 1. Introduction & Scientific Context

This document establishes the theoretical and mathematical foundation for the Physics-Informed Neural Network (PINN) implemented for Remaining Useful Life (RUL) estimation on the NASA C-MAPSS (Commercial Modular Aero-Propulsion System Simulation) benchmark datasets (**FD001, FD002, FD003, and FD004**).

> [!IMPORTANT]
> **Scientific Disclosure on Model Scope**:
> The model implemented herein is a **physically constrained degradation-kinetics PINN approximation**, rather than a full first-principles Navier-Stokes / 0D aerothermodynamic cycle simulator. Complete first-principles turbomachinery simulations require high-fidelity geometry, blade aerodynamic loss polars, and thermodynamic flow matching which are proprietary and abstracted in the C-MAPSS dataset.
> 
> Our PINN incorporates defensible, scientifically justified physical constraints:
> 1. An ordinary differential equation (ODE) governing latent mechanical degradation accumulation.
> 2. Analytical automatic differentiation of degradation derivatives with respect to operational time.
> 3. Monotonic irreversible damage constraints reflecting thermodynamic entropy and mechanical wear.
> 4. Physical boundary conditions at nominal initial and terminal failure states.

---

## 2. Physical Interpretation of C-MAPSS Variables

The NASA C-MAPSS dataset simulates high-bypass turbofan engines under run-to-failure conditions (Saxena et al., 2008). Each operational observation consists of 26 telemetry channels:

### 2.1 Identifiers & Temporal Coordinates
- **`unit_number` ($u$)**: Discrete integer identifier for an individual engine in the fleet.
- **`time_cycles` ($t$)**: Number of completed operational flight cycles (time coordinate).

### 2.2 Operational Settings (Flight Regimes $U(t)$)
- **`setting_1`**: Flight Altitude (0 to 42,000 feet). Directly determines ambient air density $\rho_{\infty}$, ambient temperature $T_{\infty}$, and ambient pressure $P_{\infty}$.
- **`setting_2`**: Flight Mach Number ($M \in [0.0, 0.84]$). Directly governs compressor face dynamic pressure and ram air compression.
- **`setting_3`**: Throttle Resolver Angle ($\text{TRA} \in [60, 100]\%$). Demands engine thrust output; determines fuel flow demand and combustor heat release.

### 2.3 Sensor Telemetry ($S(t)$)
The 21 physical sensor measurements represent thermodynamic state variables across turbofan engine stations:
- **Station 2 (Fan Inlet / LPC)**:
  - `sensor_1` ($T2$): Total temperature at fan inlet.
  - `sensor_2` ($T24$): Total temperature at LPC outlet (°R). Increases with LPC aerodynamic fouling.
  - `sensor_8` ($Nf$): Physical fan speed (rpm). Decreases as aerodynamic drag and blade degradation increase.
  - `sensor_13` ($Nf_{\text{dmd}}$): Corrected fan speed (rpm).
- **Station 3 (HPC - High Pressure Compressor)**:
  - `sensor_3` ($T30$): Total temperature at HPC outlet (°R). Elevates under blade erosion and compression loss.
  - `sensor_7` ($P30$): Total pressure at HPC outlet (psia). Drops as blade tip clearances widen and seals degrade.
  - `sensor_11` ($Ps30$): Static pressure at HPC outlet (psia).
  - `sensor_9` ($Nc$): Physical core rotor speed (rpm).
  - `sensor_14` ($Nc_{\text{dmd}}$): Corrected core rotor speed (rpm).
- **Station 4 / 5 (Combustor & Turbines - HPT / LPT)**:
  - `sensor_4` ($T50$): Total temperature at LPT outlet (°R / EGT). Key indicator of overall thermal efficiency loss.
  - `sensor_12` ($\phi$): Fuel-to-air static pressure ratio ($W_f / Ps30$). Reflects combustion efficiency drop.
  - `sensor_15` ($\text{BPR}$): Bypass ratio. Increases as core airflow decreases relative to bypass duct.
  - `sensor_17` ($htBleed$): Bleed enthalpy (BTU/lbm). Increases with thermal deterioration.
  - `sensor_20` ($W31$): High-Pressure Turbine (HPT) coolant bleed flow (lbm/s).
  - `sensor_21` ($W32$): Low-Pressure Turbine (LPT) coolant bleed flow (lbm/s).

---

## 3. Chosen Degradation-State Representation

### 3.1 Latent Degradation State $D(t)$
Let $D(t) \in [0, 1]$ denote the normalized latent degradation state of engine unit $u$ at cycle $t$:
$$D(t) = 0 \quad (\text{Brand-new engine, nominal health})$$
$$D(t) = 1 \quad (\text{Structural failure / operational retirement threshold})$$

### 3.2 Target Mapping to Remaining Useful Life (RUL)
In aircraft fleet operations, an engine operates during an initial "healthy plateau" where physical wear is negligible and telemetry does not deviate from nominal baselines. Once micro-cracks, erosion, or fouling initiate, degradation accelerates.

Following NASA benchmark convention, RUL is modeled as piecewise linear with maximum clipping threshold $RUL_{\max} = 125$ cycles:
$$\text{RUL}(t) = \min(RUL_{\max}, t_{\text{failure}} - t)$$

The relationship between latent degradation state $D(t)$ and Remaining Useful Life $\widehat{\text{RUL}}(t)$ is formulated as:
$$\widehat{\text{RUL}}(t) = RUL_{\max} \cdot (1 - D(t))$$
$$D(t) = 1 - \frac{\widehat{\text{RUL}}(t)}{RUL_{\max}}$$

---

## 4. Governing Physics Equations & Constraints

### 4.1 Degradation Rate Kinetic Law
Mechanical damage in gas turbines (Paris-Erdogan fatigue crack propagation law, thermal barrier spallation, and compressor blade erosion) follows a non-linear wear rate driven by current state and operating stress:
$$\frac{dD}{dt} = g_\theta(D(t), S(t), U(t))$$

Where:
- $g_\theta$ is a parameterized neural network rate function representing the degradation kinetics.
- $S(t)$ is the vector of condition-normalized sensor telemetry.
- $U(t)$ is the operational regime vector.

Differentiating $\widehat{\text{RUL}}(t)$ with respect to operational cycle $t$:
$$\frac{\partial \widehat{\text{RUL}}}{\partial t} = -RUL_{\max} \cdot \frac{dD}{dt} = -RUL_{\max} \cdot g_\theta(D(t), S(t), U(t))$$

Rearranging yields the **Governing Residual Balance**:
$$-\frac{\partial \widehat{\text{RUL}}}{\partial t} - RUL_{\max} \cdot g_\theta(S(t), U(t)) = 0$$

### 4.2 Monotonicity Constraint (Irreversible Entropy / Damage)
In the absence of physical depot overhaul or component replacement, mechanical degradation is thermodynamically irreversible:
$$\frac{dD}{dt} \ge 0 \iff \frac{\partial \widehat{\text{RUL}}}{\partial t} \le 0$$

This fundamental physical principle enforces that as operating flight cycles elapse, Remaining Useful Life must never increase.

---

## 5. Automatic Differentiation & Loss Formulation

### 5.1 Exact Derivative Calculation via `tf.GradientTape`
Let $t_{\text{norm}} = \frac{t}{t_{\max}}$ be the normalized continuous cycle coordinate.
In our PINN, the operational cycle tensor $t_{\text{norm}}$ is tracked differentiably during the forward pass:
```python
with tf.GradientTape(persistent=True) as tape:
    tape.watch(t_norm)
    rul_pred, rate_pred = pinn_model([X_sensors, t_norm], training=True)
    
d_rul_dt = tape.gradient(rul_pred, t_norm)
```
This guarantees exact, analytical derivatives without numerical discretization errors.

### 5.2 Composite Loss Function
The total optimization objective $\mathcal{L}_{\text{total}}$ is a composite multi-objective loss:
$$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{data}} + \lambda_{\text{physics}} \mathcal{L}_{\text{physics}} + \lambda_{\text{monotonicity}} \mathcal{L}_{\text{monotonicity}} + \lambda_{\text{boundary}} \mathcal{L}_{\text{boundary}}$$

#### 1. Data Loss ($\mathcal{L}_{\text{data}}$)
Measures supervised RUL prediction accuracy against ground-truth labels:
$$\mathcal{L}_{\text{data}} = \frac{1}{B} \sum_{i=1}^B (\text{RUL}_i - \widehat{\text{RUL}}_i)^2$$

#### 2. Physics Residual Loss ($\mathcal{L}_{\text{physics}}$)
Penalizes violations of the governing degradation ODE:
$$r_{\text{physics}, i} = -\frac{\partial \widehat{\text{RUL}}_i}{\partial t_{\text{norm}}} - RUL_{\max} \cdot g_\theta(S_i, U_i)$$
$$\mathcal{L}_{\text{physics}} = \frac{1}{B} \sum_{i=1}^B r_{\text{physics}, i}^2$$

#### 3. Monotonicity Constraint Loss ($\mathcal{L}_{\text{monotonicity}}$)
Penalizes unphysical positive derivatives where predicted RUL increases over operational time:
$$\mathcal{L}_{\text{monotonicity}} = \frac{1}{B} \sum_{i=1}^B \left( \max\left(0, \frac{\partial \widehat{\text{RUL}}_i}{\partial t_{\text{norm}}}\right) \right)^2$$

#### 4. Boundary Condition Loss ($\mathcal{L}_{\text{boundary}}$)
Enforces physical limits at initial healthy conditions and non-negativity:
$$\mathcal{L}_{\text{boundary}} = \frac{1}{B} \sum_{i=1}^B \left( \max(0, -\widehat{\text{RUL}}_i) \right)^2$$
*(Non-negative RUL is also structurally guaranteed via ReLU / Softplus output projection).*

### 5.3 Configurable Loss Weights
- $\lambda_{\text{physics}} = 0.1$
- $\lambda_{\text{monotonicity}} = 0.1$
- $\lambda_{\text{boundary}} = 0.05$

---

## 6. Assumptions and Physical Limitations

1. **Piecewise Linear RUL Plateau**: Assumes initial degradation is negligible prior to cycle $t_{\text{init}} = t_{\text{failure}} - 125$. Real crack growth may follow smooth sub-exponential curves.
2. **Discrete vs. Continuous Cycles**: Flight cycles are discrete integer flights; we model $t$ continuously to evaluate analytical automatic derivatives.
3. **No In-Flight Healing**: Assumes no mid-mission maintenance occurs, justifying strict monotonicity.
4. **Constrained Empirical Kinetics**: $g_\theta$ is a learned empirical degradation rate function rather than an OEM-certified metallurgical creep equation.
