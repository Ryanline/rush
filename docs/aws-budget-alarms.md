# AWS Budget Alarms (Do This First)

This project runs backend infra on AWS EC2, so budget alarms should be enabled before leaving services running.

## Recommended Budget Setup

Create two monthly AWS Budgets:

1. `rush-monthly-cost`
- Type: `Cost budget`
- Period: `Monthly (recurring)`
- Budgeted amount: `10 USD`
- Alert thresholds:
  - `50%` (actual + forecasted)
  - `80%` (actual + forecasted)
  - `100%` (actual + forecasted)

2. `rush-ec2-guardrail`
- Type: `Cost budget`
- Scope/filter: service = `Amazon Elastic Compute Cloud - Compute`
- Period: `Monthly (recurring)`
- Budgeted amount: `8 USD`
- Alert thresholds:
  - `80%` (actual + forecasted)
  - `100%` (actual + forecasted)

Add your email as the notification target for all alerts.

## Console Steps

1. Open AWS Console.
2. Go to `Billing and Cost Management` -> `Budgets`.
3. Click `Create budget`.
4. Choose `Cost budget`.
5. Configure values from the recommendations above.
6. In notifications, add:
- `Actual cost` threshold
- `Forecasted cost` threshold
7. Add your email subscriber and create the budget.
8. Repeat for the second budget.

## Optional Safety: AWS Free Tier Alerts

Also enable Free Tier usage alerts:

1. `Billing and Cost Management` -> `Free Tier`.
2. Turn on Free Tier alerts for your account email.

## Operational Habit

When not actively testing:

- Stop the EC2 instance to avoid unnecessary charges.
- Confirm no unattached Elastic IPs, volumes, or load balancers are left running.

## Quick Monthly Checklist

- Budgets status is `OK`.
- EC2 uptime matches your intended usage.
- No unexpected services appear in `Cost Explorer`.
