-- Fix payments trigger so student_fees.status is written as the fee_status enum
-- and student_fees.balance stays in sync after each recorded payment.

CREATE OR REPLACE FUNCTION fn_update_student_fee_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid DECIMAL(12,2);
  v_amount_due DECIMAL(12,2);
  v_next_status fee_status;
BEGIN
  SELECT COALESCE(SUM(amount_paid), 0)
  INTO v_total_paid
  FROM payments
  WHERE student_fee_id = NEW.student_fee_id;

  SELECT amount_due
  INTO v_amount_due
  FROM student_fees
  WHERE id = NEW.student_fee_id;

  v_next_status := CASE
    WHEN v_total_paid >= v_amount_due THEN 'paid'::fee_status
    WHEN v_total_paid > 0 THEN 'partial'::fee_status
    ELSE 'pending'::fee_status
  END;

  UPDATE student_fees
  SET
    amount_paid = v_total_paid,
    status = v_next_status,
    updated_at = NOW()
  WHERE id = NEW.student_fee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

WITH payment_totals AS (
  SELECT
    student_fee_id,
    COALESCE(SUM(amount_paid), 0) AS total_paid
  FROM payments
  GROUP BY student_fee_id
)
UPDATE student_fees AS sf
SET
  amount_paid = COALESCE(pt.total_paid, 0),
  status = CASE
    WHEN COALESCE(pt.total_paid, 0) >= sf.amount_due THEN 'paid'::fee_status
    WHEN COALESCE(pt.total_paid, 0) > 0 THEN 'partial'::fee_status
    WHEN sf.status = 'waived'::fee_status THEN 'waived'::fee_status
    WHEN sf.due_date IS NOT NULL AND sf.due_date < CURRENT_DATE THEN 'overdue'::fee_status
    ELSE 'pending'::fee_status
  END,
  updated_at = NOW()
FROM payment_totals AS pt
WHERE sf.id = pt.student_fee_id;

UPDATE student_fees AS sf
SET
  amount_paid = 0,
  status = CASE
    WHEN sf.status = 'waived'::fee_status THEN 'waived'::fee_status
    WHEN sf.due_date IS NOT NULL AND sf.due_date < CURRENT_DATE THEN 'overdue'::fee_status
    ELSE 'pending'::fee_status
  END,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM payments AS p
  WHERE p.student_fee_id = sf.id
);
