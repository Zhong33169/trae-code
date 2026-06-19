package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	port := os.Getenv("FRONTEND_PORT")
	if port == "" {
		port = "3004"
	}

	execPath, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}
	staticDir := filepath.Join(filepath.Dir(execPath), "..", "css")
	staticDir = ""
	cwd, _ := os.Getwd()
	staticDir = cwd

	fs := http.FileServer(http.Dir(staticDir))
	http.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "..") {
			http.NotFound(w, r)
			return
		}
		fs.ServeHTTP(w, r)
	}))

	fmt.Printf("Frontend server running on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
