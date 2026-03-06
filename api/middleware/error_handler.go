package middleware

import (
	"encoding/json"
	"net/http"
	"os"

	apierrors "api/errors"
)

func ErrorHandler(w http.ResponseWriter, err error) {
	isProd := os.Getenv("GO_ENV") == "production"

	if ae, ok := err.(apierrors.AppErrorer); ok {
		appErr := ae.AppErr()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(appErr.Code)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error": map[string]interface{}{
				"message": appErr.Message,
				"code":    appErr.Code,
			},
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	resp := map[string]interface{}{
		"success": false,
		"error": map[string]interface{}{
			"message": "Internal server error",
			"code":    500,
		},
	}
	if !isProd {
		resp["detail"] = err.Error()
	}
	json.NewEncoder(w).Encode(resp)
}
