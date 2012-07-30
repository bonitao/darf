package main

import (
	"flag"
	"io"
	"bufio"
	"os"
	"log"
	"encoding/csv"
	"strings"
	"strconv"
	"time"
)

type Transaction struct {
	date time.Time
	ttype string
	price float64
	shares uint64
	proceeds int
	balance int
}

func NewTransaction(csv_fields []string) *Transaction {
	var tr Transaction
	tr.ttype = csv_fields[1]
	price, err := strconv.ParseFloat(csv_fields[1], 64)
	if err != nil {
		log.Fatalf("Failed to parse price %v", err)
	}
	shares, err := strconv.ParseUint(csv_fields[2], 10, 64)
	if err != nil {
		log.Fatalf("Failed to parse shares %v", err)
	}
	tr.price = price
	tr.shares = shares
	return &tr
}

func read_benefit_access_csv(benefit_access_csv string) {
	f, err := os.Open(benefit_access_csv)
	if err != nil {
		log.Fatalf("Failed to read benefit access csv file %v", err)
	}
	r := bufio.NewReader(f)
	for {
		bytes, isprefix, err := r.ReadLine()
		if isprefix {
			log.Fatalf("Failed to read full line from benefit access csv file")
		}
		if err != nil {
			log.Fatalf("Failed to read line from benefit access csv file %v", err)
		}
		line := string(bytes)
		fields := strings.Split(line, ",")
		if fields[0] == "\"Transaction Date\"" {
			break
		}
	}
	reader := csv.NewReader(r)
	records, err := reader.ReadAll()
	if err != nil {
		for i := 0; i < 1; i++ {
			_, isprefix, err := r.ReadLine()
			if isprefix {
				log.Fatalf("Failed to read full line from benefit access csv file")
			}
			if err != nil {
				log.Fatalf("Failed to read line from benefit access csv file %v", err)
			}
		}
    _, _, err := r.ReadLine()
		if err != io.EOF {
			log.Fatalf("Failed to parse benefit access csv %v", err)
		}
	}
	for _, r := range records {
		_ = NewTransaction(r)
		
	}
}

func calculate_taxes(benefit_access_csv string, cpf string, output_dir string) {
	read_benefit_access_csv(benefit_access_csv)
}

var cpf string
var benefit_access_csv string
func init() {
	flag.StringVar(&cpf, "cpf", "", "Cadastro de Pessoa Fisica")
	flag.StringVar(&benefit_access_csv, "benefit_access_csv", "", "File from benefitaccess.com")
	flag.Parse()
}
func main() {
	output_dir := flag.Arg(0)
	if output_dir == "" {
		output_dir = "./imposto"
	}
	err := os.Mkdir(output_dir, os.FileMode(0700))
	if err != nil {
		log.Fatalf("Failed to create directory %v", err)
	}
	calculate_taxes(benefit_access_csv, cpf, output_dir)
	os.Exit(0)
}
