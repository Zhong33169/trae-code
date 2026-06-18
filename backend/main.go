package main

import (
	"log"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8005"
	}
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/renewal.db"
	}
	db := MustInitDB(dbPath)
	defer db.Close()
	MustSeed(db)

	r := NewRouter(db)
	log.Printf("续保复核后端已启动：端口 :%s，CORS 放行 http://localhost:3005", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
