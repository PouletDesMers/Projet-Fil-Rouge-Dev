package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

type stripeChargeReq struct {
	TokenID  string  `json:"tokenId"`
	Amount   int64   `json:"amount"`
	Currency string  `json:"currency"`
}

func CreateStripeCharge(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		jsonErr(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	_ = userID

	var req stripeChargeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.TokenID == "" || req.Amount <= 0 {
		jsonErr(w, "tokenId and amount are required", http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		req.Currency = "eur"
	}

	secretKey := os.Getenv("STRIPE_SECRET_KEY")
	if secretKey == "" || strings.HasPrefix(secretKey, "sk_test_...") {
		jsonErr(w, "Stripe not configured — set STRIPE_SECRET_KEY", http.StatusServiceUnavailable)
		return
	}

	params := url.Values{}
	params.Set("amount", fmt.Sprintf("%d", req.Amount))
	params.Set("currency", req.Currency)
	params.Set("source", req.TokenID)
	params.Set("description", "Commande CYNA")

	stripeReq, err := http.NewRequest("POST", "https://api.stripe.com/v1/charges", strings.NewReader(params.Encode()))
	if err != nil {
		jsonErr(w, "Internal error", http.StatusInternalServerError)
		return
	}
	stripeReq.Header.Set("Authorization", "Bearer "+secretKey)
	stripeReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := (&http.Client{}).Do(stripeReq)
	if err != nil {
		jsonErr(w, "Payment service unavailable", http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var stripeResp struct {
		ID    string `json:"id"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	json.Unmarshal(body, &stripeResp)

	if resp.StatusCode != http.StatusOK {
		msg := "Payment failed"
		if stripeResp.Error != nil {
			msg = stripeResp.Error.Message
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)
		json.NewEncoder(w).Encode(map[string]string{"error": msg})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"chargeId": stripeResp.ID,
	})
}
