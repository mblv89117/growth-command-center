import { CASH_FORECAST_WEEKS } from "../src/lib/mock-data";
import { validateCashForecastWeeks } from "../src/lib/forecast/validate";

const errors = validateCashForecastWeeks(CASH_FORECAST_WEEKS);
if (errors.length) {
  console.error("Forecast validation failed:");
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}

console.log(`Forecast validation passed (${CASH_FORECAST_WEEKS.length} weeks)`);
