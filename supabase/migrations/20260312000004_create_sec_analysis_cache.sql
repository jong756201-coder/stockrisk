-- Create a table to cache SEC risk analysis results
CREATE TABLE IF NOT EXISTS sec_risk_analysis (
    symbol TEXT PRIMARY KEY,
    analysis_json JSONB NOT NULL,
    filings_scanned INTEGER NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE sec_risk_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on sec_risk_analysis"
    ON sec_risk_analysis FOR SELECT
    USING (true);

CREATE POLICY "Allow service role to manage sec_risk_analysis"
    ON sec_risk_analysis FOR ALL
    USING (auth.uid() IS NULL); -- Simple check for service role in this context, or just true since backend uses service key
