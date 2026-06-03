import json

DIVIDEND_DATA = {
    'MTNN': {'ticker': 'MTNN', 'yieldPct': 8.5, 'amountPerShare': 15.6, 'exDividendDate': '2024-04-18', 'paymentDate': '2024-05-24'},
    'ZENITHBANK': {'ticker': 'ZENITHBANK', 'yieldPct': 12.4, 'amountPerShare': 3.5, 'exDividendDate': '2024-04-25', 'paymentDate': '2024-05-08'},
    'GTCO': {'ticker': 'GTCO', 'yieldPct': 8.8, 'amountPerShare': 3.2, 'exDividendDate': '2024-04-20', 'paymentDate': '2024-05-15'},
    'AIRTELAFRI': {'ticker': 'AIRTELAFRI', 'yieldPct': 4.2, 'amountPerShare': 110, 'exDividendDate': '2024-06-20', 'paymentDate': '2024-07-26'},
    'SEPLAT': {'ticker': 'SEPLAT', 'yieldPct': 5.5, 'amountPerShare': 150, 'exDividendDate': '2024-05-10', 'paymentDate': '2024-05-30'},
    'DANGCEM': {'ticker': 'DANGCEM', 'yieldPct': 5.8, 'amountPerShare': 30.0, 'exDividendDate': '2024-04-15', 'paymentDate': '2024-04-30'},
    'NESTLE': {'ticker': 'NESTLE', 'yieldPct': 10.5, 'amountPerShare': 45.0, 'exDividendDate': '2024-05-20', 'paymentDate': '2024-06-15'},
    'BUACEMENT': {'ticker': 'BUACEMENT', 'yieldPct': 6.2, 'amountPerShare': 2.8, 'exDividendDate': '2024-07-11', 'paymentDate': '2024-08-05'},
}

def get_all_dividends():
    return DIVIDEND_DATA

def get_dividend_for_ticker(ticker):
    return DIVIDEND_DATA.get(ticker)

def calculate_passive_income(positions):
    """
    positions: list of dicts with 'ticker' and 'shares'
    """
    projected_income = 0
    for pos in positions:
        ticker = pos.get('ticker')
        shares = pos.get('shares', 0)
        div = DIVIDEND_DATA.get(ticker)
        if div:
            projected_income += shares * div.get('amountPerShare', 0)
    return projected_income

if __name__ == "__main__":
    # Example usage
    sample_portfolio = [
        {'ticker': 'MTNN', 'shares': 1000},
        {'ticker': 'ZENITHBANK', 'shares': 5000}
    ]
    income = calculate_passive_income(sample_portfolio)
    print(f"Projected Annual Passive Income: N{income:,.2f}")
    print("\nDividend Schedules:")
    print(json.dumps(DIVIDEND_DATA, indent=2))
