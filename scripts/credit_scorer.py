"""
CreditFi AI Credit Scoring Model
Uses scikit-learn to score AI agents based on on-chain behavior.
Deployed via 0G Compute Network for decentralized inference.
"""

import json
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import MinMaxScaler
import joblib
import os


# ── Feature Engineering ────────────────────────────────────────────────────────

def extract_features(agent_data: dict) -> np.ndarray:
    """
    Transform raw on-chain agent data into model features.

    Features:
        0. repayment_rate       — successful repayments / total borrows
        1. avg_borrow_duration  — avg days to repay (lower = better)
        2. collateral_ratio     — avg deposited / borrowed ratio
        3. activity_frequency   — txns per week
        4. default_rate         — defaults / total borrows
        5. total_repaid_norm    — lifetime repaid (log-scaled)
        6. account_age_days     — days since first tx
        7. overpayment_rate     — times repaid more than owed (signals good faith)
    """
    total_borrows = max(agent_data.get("total_borrows", 1), 1)
    repayments    = agent_data.get("successful_repayments", 0)
    defaults      = agent_data.get("defaults", 0)
    total_repaid  = agent_data.get("total_repaid_eth", 0)
    avg_duration  = agent_data.get("avg_repay_days", 30)
    collateral    = agent_data.get("avg_collateral_ratio", 1.5)
    activity      = agent_data.get("txns_per_week", 1)
    age_days      = agent_data.get("account_age_days", 1)
    overpayments  = agent_data.get("overpayments", 0)

    features = np.array([
        repayments / total_borrows,
        min(avg_duration, 90) / 90,          # normalize to [0,1]
        min(collateral, 5) / 5,
        min(activity, 50) / 50,
        defaults / total_borrows,
        np.log1p(total_repaid) / 10,
        min(age_days, 365) / 365,
        overpayments / total_borrows,
    ]).reshape(1, -1)

    return features


# ── Score Mapping ──────────────────────────────────────────────────────────────

def raw_to_credit_score(raw_score: float) -> int:
    """Map model probability [0,1] to FICO-like range [300, 850]."""
    return int(300 + raw_score * 550)


# ── Model Training ─────────────────────────────────────────────────────────────

def generate_synthetic_training_data(n=2000):
    """Generate synthetic training data when real on-chain data is limited."""
    np.random.seed(42)
    X, y = [], []

    for _ in range(n):
        # Good agent
        if np.random.random() > 0.3:
            features = {
                "total_borrows": np.random.randint(5, 50),
                "successful_repayments": np.random.randint(4, 50),
                "defaults": np.random.randint(0, 2),
                "total_repaid_eth": np.random.uniform(1, 20),
                "avg_repay_days": np.random.uniform(1, 14),
                "avg_collateral_ratio": np.random.uniform(1.5, 4),
                "txns_per_week": np.random.uniform(3, 30),
                "account_age_days": np.random.randint(30, 365),
                "overpayments": np.random.randint(0, 5),
            }
            label = np.random.uniform(0.6, 1.0)
        # Bad agent
        else:
            features = {
                "total_borrows": np.random.randint(1, 20),
                "successful_repayments": np.random.randint(0, 5),
                "defaults": np.random.randint(1, 10),
                "total_repaid_eth": np.random.uniform(0, 2),
                "avg_repay_days": np.random.uniform(30, 90),
                "avg_collateral_ratio": np.random.uniform(1.0, 1.8),
                "txns_per_week": np.random.uniform(0.1, 5),
                "account_age_days": np.random.randint(1, 60),
                "overpayments": 0,
            }
            label = np.random.uniform(0.0, 0.45)

        X.append(extract_features(features).flatten())
        y.append(label)

    return np.array(X), np.array(y)


def train_model():
    print("🤖 Training CreditFi AI Scoring Model...")
    X, y = generate_synthetic_training_data(2000)

    # Convert continuous scores to classes for GBM
    y_class = (y > 0.5).astype(int)

    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        random_state=42,
    )
    model.fit(X, y_class)

    # Save model
    os.makedirs("model", exist_ok=True)
    joblib.dump(model, "model/creditfi_model.pkl")
    print("✅ Model saved to model/creditfi_model.pkl")
    return model


# ── Inference (called by 0G Compute oracle) ────────────────────────────────────

def score_agent(agent_data: dict, model=None) -> dict:
    """
    Score an agent and return result for on-chain oracle submission.

    Args:
        agent_data: Dict of on-chain metrics for the agent
        model: Pre-loaded sklearn model (loaded from disk if None)

    Returns:
        Dict with credit_score (300–850) and breakdown
    """
    if model is None:
        model_path = "model/creditfi_model.pkl"
        if not os.path.exists(model_path):
            model = train_model()
        else:
            model = joblib.load(model_path)

    features = extract_features(agent_data)
    prob = model.predict_proba(features)[0][1]  # probability of "good" class

    credit_score = raw_to_credit_score(prob)

    # Score breakdown for transparency
    feat_names = [
        "repayment_rate", "avg_borrow_duration", "collateral_ratio",
        "activity_frequency", "default_rate", "total_repaid",
        "account_age", "overpayment_rate"
    ]
    breakdown = {name: round(float(features[0][i]), 3) for i, name in enumerate(feat_names)}

    return {
        "address": agent_data.get("address", "unknown"),
        "credit_score": credit_score,
        "risk_tier": _risk_tier(credit_score),
        "max_ltv_pct": _max_ltv(credit_score),
        "breakdown": breakdown,
        "model_confidence": round(float(prob), 3),
    }


def _risk_tier(score: int) -> str:
    if score >= 750: return "Prime"
    if score >= 650: return "Near-Prime"
    if score >= 550: return "Sub-Prime"
    return "High-Risk"


def _max_ltv(score: int) -> float:
    """Mirror contract's LTV formula."""
    return round(50 + (score - 300) * 25 / 550, 1)


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Score from JSON file
        with open(sys.argv[1]) as f:
            data = json.load(f)
        result = score_agent(data)
        print(json.dumps(result, indent=2))
    else:
        # Demo scoring
        demo_agent = {
            "address": "0xDemoAgent123",
            "total_borrows": 12,
            "successful_repayments": 11,
            "defaults": 1,
            "total_repaid_eth": 8.5,
            "avg_repay_days": 7,
            "avg_collateral_ratio": 2.2,
            "txns_per_week": 8,
            "account_age_days": 120,
            "overpayments": 2,
        }
        result = score_agent(demo_agent)
        print("\n🔍 Demo Agent Scoring Result:")
        print(json.dumps(result, indent=2))
