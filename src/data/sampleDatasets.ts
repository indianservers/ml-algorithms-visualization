export interface Dataset {
  id: string;
  name: string;
  description: string;
  type: 'regression' | 'classification' | 'clustering' | 'timeSeries' | 'nlp' | 'recommendation';
  columns: string[];
  data: Record<string, unknown>[];
}

// Iris dataset (subset)
export const irisDataset: Dataset = {
  id: 'iris',
  name: 'Iris Dataset',
  description: 'Classic flower classification dataset with 3 classes and 4 features.',
  type: 'classification',
  columns: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width', 'species'],
  data: [
    { sepal_length: 5.1, sepal_width: 3.5, petal_length: 1.4, petal_width: 0.2, species: 'setosa' },
    { sepal_length: 4.9, sepal_width: 3.0, petal_length: 1.4, petal_width: 0.2, species: 'setosa' },
    { sepal_length: 4.7, sepal_width: 3.2, petal_length: 1.3, petal_width: 0.2, species: 'setosa' },
    { sepal_length: 4.6, sepal_width: 3.1, petal_length: 1.5, petal_width: 0.2, species: 'setosa' },
    { sepal_length: 5.0, sepal_width: 3.6, petal_length: 1.4, petal_width: 0.2, species: 'setosa' },
    { sepal_length: 5.4, sepal_width: 3.9, petal_length: 1.7, petal_width: 0.4, species: 'setosa' },
    { sepal_length: 4.6, sepal_width: 3.4, petal_length: 1.4, petal_width: 0.3, species: 'setosa' },
    { sepal_length: 5.0, sepal_width: 3.4, petal_length: 1.5, petal_width: 0.2, species: 'setosa' },
    { sepal_length: 4.4, sepal_width: 2.9, petal_length: 1.4, petal_width: 0.2, species: 'setosa' },
    { sepal_length: 4.9, sepal_width: 3.1, petal_length: 1.5, petal_width: 0.1, species: 'setosa' },
    { sepal_length: 7.0, sepal_width: 3.2, petal_length: 4.7, petal_width: 1.4, species: 'versicolor' },
    { sepal_length: 6.4, sepal_width: 3.2, petal_length: 4.5, petal_width: 1.5, species: 'versicolor' },
    { sepal_length: 6.9, sepal_width: 3.1, petal_length: 4.9, petal_width: 1.5, species: 'versicolor' },
    { sepal_length: 5.5, sepal_width: 2.3, petal_length: 4.0, petal_width: 1.3, species: 'versicolor' },
    { sepal_length: 6.5, sepal_width: 2.8, petal_length: 4.6, petal_width: 1.5, species: 'versicolor' },
    { sepal_length: 6.3, sepal_width: 3.3, petal_length: 6.0, petal_width: 2.5, species: 'virginica' },
    { sepal_length: 5.8, sepal_width: 2.7, petal_length: 5.1, petal_width: 1.9, species: 'virginica' },
    { sepal_length: 7.1, sepal_width: 3.0, petal_length: 5.9, petal_width: 2.1, species: 'virginica' },
    { sepal_length: 6.3, sepal_width: 2.9, petal_length: 5.6, petal_width: 1.8, species: 'virginica' },
    { sepal_length: 6.5, sepal_width: 3.0, petal_length: 5.8, petal_width: 2.2, species: 'virginica' },
  ],
};

export const housingDataset: Dataset = {
  id: 'housing',
  name: 'Housing Price Dataset',
  description: 'Predict house prices based on area, rooms, and location features.',
  type: 'regression',
  columns: ['area_sqft', 'bedrooms', 'bathrooms', 'age_years', 'distance_center', 'price'],
  data: [
    { area_sqft: 1500, bedrooms: 3, bathrooms: 2, age_years: 10, distance_center: 5, price: 250000 },
    { area_sqft: 2000, bedrooms: 4, bathrooms: 3, age_years: 5, distance_center: 8, price: 320000 },
    { area_sqft: 1200, bedrooms: 2, bathrooms: 1, age_years: 20, distance_center: 3, price: 180000 },
    { area_sqft: 2500, bedrooms: 5, bathrooms: 4, age_years: 2, distance_center: 12, price: 420000 },
    { area_sqft: 1800, bedrooms: 3, bathrooms: 2, age_years: 8, distance_center: 6, price: 290000 },
    { area_sqft: 1100, bedrooms: 2, bathrooms: 1, age_years: 30, distance_center: 2, price: 160000 },
    { area_sqft: 3000, bedrooms: 5, bathrooms: 4, age_years: 1, distance_center: 15, price: 510000 },
    { area_sqft: 1600, bedrooms: 3, bathrooms: 2, age_years: 12, distance_center: 7, price: 265000 },
    { area_sqft: 2200, bedrooms: 4, bathrooms: 3, age_years: 6, distance_center: 9, price: 355000 },
    { area_sqft: 900,  bedrooms: 2, bathrooms: 1, age_years: 40, distance_center: 1, price: 135000 },
    { area_sqft: 1750, bedrooms: 3, bathrooms: 2, age_years: 9, distance_center: 5, price: 280000 },
    { area_sqft: 2800, bedrooms: 5, bathrooms: 3, age_years: 3, distance_center: 11, price: 460000 },
    { area_sqft: 1400, bedrooms: 3, bathrooms: 2, age_years: 15, distance_center: 4, price: 225000 },
    { area_sqft: 2100, bedrooms: 4, bathrooms: 3, age_years: 7, distance_center: 10, price: 340000 },
    { area_sqft: 1300, bedrooms: 2, bathrooms: 1, age_years: 25, distance_center: 3, price: 195000 },
  ],
};

export const studentMarksDataset: Dataset = {
  id: 'student-marks',
  name: 'Student Marks Dataset',
  description: '120 deterministic student records where more study hours generally lead to higher marks.',
  type: 'regression',
  columns: ['study_hours', 'marks'],
  data: Array.from({ length: 120 }, (_, index) => {
    const hours = 0.5 + (index % 40) * 0.25 + Math.floor(index / 40) * 0.08;
    const disciplineBoost = ((index * 7) % 11) - 5;
    const attendanceBoost = ((index * 13) % 9) - 4;
    const marks = Math.max(18, Math.min(99, 22 + hours * 7.3 + disciplineBoost * 0.9 + attendanceBoost * 0.45));
    return {
      student_id: index + 1,
      study_hours: parseFloat(hours.toFixed(2)),
      marks: parseFloat(marks.toFixed(1)),
    };
  }),
};

export const mallCustomersDataset: Dataset = {
  id: 'mall-customers',
  name: 'Mall Customers Clustering',
  description: 'Customer segmentation based on annual income and spending score.',
  type: 'clustering',
  columns: ['customer_id', 'age', 'annual_income', 'spending_score'],
  data: [
    { customer_id: 1, age: 19, annual_income: 15, spending_score: 39 },
    { customer_id: 2, age: 21, annual_income: 15, spending_score: 81 },
    { customer_id: 3, age: 20, annual_income: 16, spending_score: 6 },
    { customer_id: 4, age: 23, annual_income: 16, spending_score: 77 },
    { customer_id: 5, age: 31, annual_income: 17, spending_score: 40 },
    { customer_id: 6, age: 22, annual_income: 17, spending_score: 76 },
    { customer_id: 7, age: 35, annual_income: 18, spending_score: 6 },
    { customer_id: 8, age: 23, annual_income: 18, spending_score: 94 },
    { customer_id: 9, age: 64, annual_income: 19, spending_score: 3 },
    { customer_id: 10, age: 30, annual_income: 19, spending_score: 72 },
    { customer_id: 11, age: 67, annual_income: 19, spending_score: 14 },
    { customer_id: 12, age: 35, annual_income: 20, spending_score: 99 },
    { customer_id: 13, age: 58, annual_income: 20, spending_score: 15 },
    { customer_id: 14, age: 24, annual_income: 20, spending_score: 77 },
    { customer_id: 15, age: 37, annual_income: 21, spending_score: 13 },
    { customer_id: 16, age: 22, annual_income: 21, spending_score: 79 },
    { customer_id: 17, age: 35, annual_income: 23, spending_score: 35 },
    { customer_id: 18, age: 20, annual_income: 24, spending_score: 35 },
    { customer_id: 19, age: 52, annual_income: 25, spending_score: 28 },
    { customer_id: 20, age: 35, annual_income: 25, spending_score: 72 },
    { customer_id: 21, age: 35, annual_income: 28, spending_score: 17 },
    { customer_id: 22, age: 25, annual_income: 28, spending_score: 73 },
    { customer_id: 23, age: 46, annual_income: 29, spending_score: 10 },
    { customer_id: 24, age: 31, annual_income: 29, spending_score: 78 },
    { customer_id: 25, age: 54, annual_income: 30, spending_score: 20 },
    { customer_id: 26, age: 29, annual_income: 30, spending_score: 73 },
    { customer_id: 27, age: 45, annual_income: 33, spending_score: 5 },
    { customer_id: 28, age: 35, annual_income: 33, spending_score: 73 },
    { customer_id: 29, age: 40, annual_income: 37, spending_score: 26 },
    { customer_id: 30, age: 23, annual_income: 37, spending_score: 75 },
    { customer_id: 31, age: 60, annual_income: 38, spending_score: 35 },
    { customer_id: 32, age: 21, annual_income: 38, spending_score: 92 },
    { customer_id: 33, age: 53, annual_income: 39, spending_score: 36 },
    { customer_id: 34, age: 18, annual_income: 39, spending_score: 61 },
    { customer_id: 35, age: 49, annual_income: 39, spending_score: 28 },
    { customer_id: 36, age: 21, annual_income: 39, spending_score: 65 },
    { customer_id: 37, age: 42, annual_income: 40, spending_score: 55 },
    { customer_id: 38, age: 30, annual_income: 40, spending_score: 47 },
    { customer_id: 39, age: 36, annual_income: 42, spending_score: 42 },
    { customer_id: 40, age: 20, annual_income: 42, spending_score: 52 },
  ],
};

export const timeSeriesSalesDataset: Dataset = {
  id: 'time-series-sales',
  name: 'Time Series Sales Dataset',
  description: 'Monthly sales data for forecasting demonstrations.',
  type: 'timeSeries',
  columns: ['month', 'sales'],
  data: [
    { month: 'Jan 2022', sales: 1200 }, { month: 'Feb 2022', sales: 1350 },
    { month: 'Mar 2022', sales: 1600 }, { month: 'Apr 2022', sales: 1450 },
    { month: 'May 2022', sales: 1700 }, { month: 'Jun 2022', sales: 1900 },
    { month: 'Jul 2022', sales: 2100 }, { month: 'Aug 2022', sales: 2000 },
    { month: 'Sep 2022', sales: 1850 }, { month: 'Oct 2022', sales: 2200 },
    { month: 'Nov 2022', sales: 2600 }, { month: 'Dec 2022', sales: 3100 },
    { month: 'Jan 2023', sales: 1400 }, { month: 'Feb 2023', sales: 1600 },
    { month: 'Mar 2023', sales: 1900 }, { month: 'Apr 2023', sales: 1750 },
    { month: 'May 2023', sales: 2000 }, { month: 'Jun 2023', sales: 2200 },
    { month: 'Jul 2023', sales: 2400 }, { month: 'Aug 2023', sales: 2300 },
    { month: 'Sep 2023', sales: 2100 }, { month: 'Oct 2023', sales: 2500 },
    { month: 'Nov 2023', sales: 2900 }, { month: 'Dec 2023', sales: 3500 },
  ],
};

export const sentimentDataset: Dataset = {
  id: 'sentiment',
  name: 'Text Sentiment Dataset',
  description: 'Labeled text samples for sentiment analysis.',
  type: 'nlp',
  columns: ['text', 'label'],
  data: [
    { text: 'I absolutely love this product!', label: 'positive' },
    { text: 'This is the worst experience ever.', label: 'negative' },
    { text: 'The service was okay, nothing special.', label: 'neutral' },
    { text: 'Amazing quality and fast delivery!', label: 'positive' },
    { text: 'Very disappointed with the results.', label: 'negative' },
    { text: 'Great value for money!', label: 'positive' },
    { text: 'The product broke after two days.', label: 'negative' },
    { text: 'Decent product, does what it says.', label: 'neutral' },
    { text: 'Exceeded my expectations completely!', label: 'positive' },
    { text: 'Would not recommend to anyone.', label: 'negative' },
    { text: 'Pretty average, nothing extraordinary.', label: 'neutral' },
    { text: 'Brilliant! Best purchase this year.', label: 'positive' },
    { text: 'Terrible customer service.', label: 'negative' },
    { text: 'It works as advertised.', label: 'neutral' },
    { text: 'Incredibly happy with this!', label: 'positive' },
  ],
};

export const spamDataset: Dataset = {
  id: 'spam',
  name: 'Spam / Ham Email Dataset',
  description: 'Email texts labeled as spam or ham for classification.',
  type: 'nlp',
  columns: ['text', 'label'],
  data: [
    { text: 'Congratulations! You have won a $1000 prize. Click here to claim now!', label: 'spam' },
    { text: 'Hi, are we still meeting tomorrow at 3pm?', label: 'ham' },
    { text: 'FREE OFFER! Get rich quick! Limited time only!!!', label: 'spam' },
    { text: 'Please find the attached quarterly report.', label: 'ham' },
    { text: 'URGENT: Your account has been suspended. Verify now!', label: 'spam' },
    { text: 'Can you review the pull request when you get a chance?', label: 'ham' },
    { text: 'Win an iPhone 15! Just complete this survey!', label: 'spam' },
    { text: 'The meeting has been rescheduled to Monday.', label: 'ham' },
    { text: 'Cheap meds online! No prescription needed!', label: 'spam' },
    { text: 'Thanks for sending over the documents.', label: 'ham' },
  ],
};

export const ratingsDataset: Dataset = {
  id: 'ratings',
  name: 'Movie Ratings Matrix',
  description: 'User-item rating matrix for collaborative filtering.',
  type: 'recommendation',
  columns: ['user', 'movie_a', 'movie_b', 'movie_c', 'movie_d', 'movie_e'],
  data: [
    { user: 'Alice', movie_a: 5, movie_b: 3, movie_c: null, movie_d: 1, movie_e: 4 },
    { user: 'Bob', movie_a: 4, movie_b: null, movie_c: 4, movie_d: 1, movie_e: 2 },
    { user: 'Carol', movie_a: null, movie_b: 3, movie_c: 5, movie_d: null, movie_e: 3 },
    { user: 'Dave', movie_a: 1, movie_b: 2, movie_c: 4, movie_d: 5, movie_e: null },
    { user: 'Eve', movie_a: null, movie_b: 4, movie_c: 3, movie_d: 4, movie_e: 2 },
  ],
};

export const loanDataset: Dataset = {
  id: 'loan',
  name: 'Loan Approval Dataset',
  description: 'Binary classification dataset for loan approval prediction.',
  type: 'classification',
  columns: ['income', 'credit_score', 'debt_ratio', 'employment_years', 'approved'],
  data: [
    { income: 75000, credit_score: 720, debt_ratio: 0.25, employment_years: 5, approved: 1 },
    { income: 35000, credit_score: 580, debt_ratio: 0.55, employment_years: 1, approved: 0 },
    { income: 90000, credit_score: 780, debt_ratio: 0.20, employment_years: 10, approved: 1 },
    { income: 45000, credit_score: 640, debt_ratio: 0.40, employment_years: 3, approved: 1 },
    { income: 28000, credit_score: 540, debt_ratio: 0.65, employment_years: 0, approved: 0 },
    { income: 120000, credit_score: 800, debt_ratio: 0.15, employment_years: 15, approved: 1 },
    { income: 52000, credit_score: 670, debt_ratio: 0.35, employment_years: 6, approved: 1 },
    { income: 31000, credit_score: 560, debt_ratio: 0.60, employment_years: 2, approved: 0 },
    { income: 68000, credit_score: 710, debt_ratio: 0.28, employment_years: 8, approved: 1 },
    { income: 22000, credit_score: 510, debt_ratio: 0.70, employment_years: 0, approved: 0 },
    { income: 85000, credit_score: 755, debt_ratio: 0.22, employment_years: 12, approved: 1 },
    { income: 40000, credit_score: 610, debt_ratio: 0.45, employment_years: 4, approved: 0 },
    { income: 60000, credit_score: 690, debt_ratio: 0.32, employment_years: 7, approved: 1 },
    { income: 33000, credit_score: 570, debt_ratio: 0.58, employment_years: 1, approved: 0 },
    { income: 95000, credit_score: 790, debt_ratio: 0.18, employment_years: 14, approved: 1 },
  ],
};

export const customerChurnDataset: Dataset = {
  id: 'customer-churn',
  name: 'Customer Churn Dataset',
  description: 'Subscription customers with tenure, usage, support activity, and churn labels for classification and explainability.',
  type: 'classification',
  columns: ['customer_id', 'tenure_months', 'monthly_fee', 'usage_hours', 'support_tickets', 'late_payments', 'satisfaction', 'churned'],
  data: Array.from({ length: 140 }, (_, index) => {
    const tenure = 1 + (index * 7) % 60;
    const monthlyFee = 18 + ((index * 11) % 80);
    const usage = 4 + ((index * 13) % 95) / 2;
    const supportTickets = (index * 5) % 8;
    const latePayments = (index * 3) % 5;
    const satisfaction = Math.max(1, Math.min(10, 9 - supportTickets * 0.8 - latePayments * 0.7 + usage / 35 - monthlyFee / 120));
    const churnScore = monthlyFee / 28 + supportTickets * 1.6 + latePayments * 2.1 - tenure / 16 - usage / 20 - satisfaction;
    return {
      customer_id: index + 1,
      tenure_months: tenure,
      monthly_fee: Number(monthlyFee.toFixed(2)),
      usage_hours: Number(usage.toFixed(1)),
      support_tickets: supportTickets,
      late_payments: latePayments,
      satisfaction: Number(satisfaction.toFixed(1)),
      churned: churnScore > -0.6 ? 1 : 0,
    };
  }),
};

export const medicalRiskDataset: Dataset = {
  id: 'medical-risk',
  name: 'Medical Risk Screening Dataset',
  description: 'Synthetic patient screening table for logistic regression, trees, ROC/PR curves, and feature importance.',
  type: 'classification',
  columns: ['patient_id', 'age', 'bmi', 'systolic_bp', 'cholesterol', 'glucose', 'exercise_hours', 'high_risk'],
  data: Array.from({ length: 150 }, (_, index) => {
    const age = 22 + (index * 3) % 58;
    const bmi = 18 + ((index * 7) % 170) / 10;
    const systolic = 102 + (index * 11) % 68;
    const cholesterol = 145 + (index * 13) % 120;
    const glucose = 74 + (index * 17) % 88;
    const exercise = ((index * 5) % 16) / 2;
    const risk = age * 0.035 + bmi * 0.11 + systolic * 0.018 + cholesterol * 0.008 + glucose * 0.015 - exercise * 0.32;
    return {
      patient_id: index + 1,
      age,
      bmi: Number(bmi.toFixed(1)),
      systolic_bp: systolic,
      cholesterol,
      glucose,
      exercise_hours: Number(exercise.toFixed(1)),
      high_risk: risk > 9.2 ? 1 : 0,
    };
  }),
};

export const fraudTransactionsDataset: Dataset = {
  id: 'fraud-transactions',
  name: 'Fraud Transactions Dataset',
  description: 'Payment transactions with amount, timing, device, distance, and fraud labels for imbalanced classification.',
  type: 'classification',
  columns: ['transaction_id', 'amount', 'hour', 'merchant_risk', 'device_age_days', 'distance_from_home_km', 'previous_declines', 'fraud'],
  data: Array.from({ length: 180 }, (_, index) => {
    const amount = 12 + ((index * 37) % 900) + ((index % 9) * 0.79);
    const hour = (index * 5) % 24;
    const merchantRisk = ((index * 7) % 10) / 10;
    const deviceAge = (index * 19) % 720;
    const distance = ((index * 23) % 400) / 2;
    const declines = (index * 11) % 4;
    const suspicious = amount > 620 || (hour < 5 && distance > 120) || (merchantRisk > 0.7 && declines >= 2) || deviceAge < 10;
    return {
      transaction_id: index + 1,
      amount: Number(amount.toFixed(2)),
      hour,
      merchant_risk: Number(merchantRisk.toFixed(1)),
      device_age_days: deviceAge,
      distance_from_home_km: Number(distance.toFixed(1)),
      previous_declines: declines,
      fraud: suspicious ? 1 : 0,
    };
  }),
};

export const energyDemandDataset: Dataset = {
  id: 'energy-demand',
  name: 'Energy Demand Regression Dataset',
  description: 'Hourly energy demand from weather and calendar signals for regression, boosting, and feature selection.',
  type: 'regression',
  columns: ['hour_id', 'temperature_c', 'humidity', 'wind_kph', 'is_weekend', 'hour_of_day', 'demand_mw'],
  data: Array.from({ length: 168 }, (_, index) => {
    const hour = index % 24;
    const day = Math.floor(index / 24);
    const temperature = 18 + Math.sin(index / 9) * 9 + (hour > 13 ? 4 : 0);
    const humidity = 42 + Math.cos(index / 11) * 22;
    const wind = 5 + ((index * 7) % 28);
    const weekend = day % 7 >= 5 ? 1 : 0;
    const eveningPeak = hour >= 18 && hour <= 22 ? 55 : 0;
    const workdayLoad = weekend ? -28 : 24;
    const demand = 260 + Math.max(0, temperature - 22) * 7 + Math.max(0, 18 - temperature) * 5 + eveningPeak + workdayLoad + humidity * 0.35 - wind * 0.8;
    return {
      hour_id: index + 1,
      temperature_c: Number(temperature.toFixed(1)),
      humidity: Number(humidity.toFixed(1)),
      wind_kph: wind,
      is_weekend: weekend,
      hour_of_day: hour,
      demand_mw: Number(demand.toFixed(1)),
    };
  }),
};

export const weatherDailyDataset: Dataset = {
  id: 'weather-daily',
  name: 'Daily Weather Forecast Dataset',
  description: 'Daily temperature, rainfall, humidity, and wind patterns for time-series smoothing and anomaly detection.',
  type: 'timeSeries',
  columns: ['day', 'temperature_c', 'rainfall_mm', 'humidity', 'wind_kph'],
  data: Array.from({ length: 120 }, (_, index) => {
    const temperature = 21 + Math.sin(index / 14) * 8 + Math.sin(index / 4) * 1.8;
    const rainfall = Math.max(0, Math.sin(index / 6) * 12 + ((index * 7) % 5) - 3);
    return {
      day: `Day ${index + 1}`,
      temperature_c: Number(temperature.toFixed(1)),
      rainfall_mm: Number(rainfall.toFixed(1)),
      humidity: Number((58 + rainfall * 1.7 + Math.cos(index / 8) * 12).toFixed(1)),
      wind_kph: Number((8 + ((index * 5) % 18) + Math.sin(index / 5) * 2).toFixed(1)),
    };
  }),
};

export const sensorAnomalyDataset: Dataset = {
  id: 'sensor-anomaly',
  name: 'Factory Sensor Anomaly Dataset',
  description: 'Machine sensor readings with vibration, pressure, temperature, and anomaly labels for outlier and time-series labs.',
  type: 'timeSeries',
  columns: ['timestamp', 'temperature_c', 'vibration_mm_s', 'pressure_bar', 'throughput', 'is_anomaly'],
  data: Array.from({ length: 144 }, (_, index) => {
    const spike = index % 47 === 0 || index % 61 === 0;
    const temperature = 63 + Math.sin(index / 10) * 4 + (spike ? 13 : 0);
    const vibration = 2.2 + Math.cos(index / 8) * 0.7 + (spike ? 3.6 : 0);
    const pressure = 7.8 + Math.sin(index / 12) * 0.9 + (spike ? -2.2 : 0);
    return {
      timestamp: `T+${index}`,
      temperature_c: Number(temperature.toFixed(1)),
      vibration_mm_s: Number(vibration.toFixed(2)),
      pressure_bar: Number(pressure.toFixed(2)),
      throughput: Number((94 + Math.sin(index / 6) * 8 - (spike ? 24 : 0)).toFixed(1)),
      is_anomaly: spike ? 1 : 0,
    };
  }),
};

export const retailBasketDataset: Dataset = {
  id: 'retail-basket',
  name: 'Retail Basket Dataset',
  description: 'Customer baskets with item counts and spend for clustering, association-style exploration, and recommendations.',
  type: 'clustering',
  columns: ['basket_id', 'produce', 'dairy', 'bakery', 'meat', 'snacks', 'household', 'basket_value', 'segment'],
  data: Array.from({ length: 120 }, (_, index) => {
    const segmentId = index % 4;
    const produce = segmentId === 0 ? 6 + index % 5 : 1 + index % 4;
    const dairy = segmentId === 1 ? 5 + index % 4 : 1 + (index * 2) % 4;
    const bakery = segmentId === 2 ? 5 + index % 5 : 1 + (index * 3) % 3;
    const meat = segmentId === 3 ? 4 + index % 4 : (index * 5) % 3;
    const snacks = segmentId === 2 ? 6 + (index * 2) % 5 : 1 + index % 4;
    const household = segmentId === 3 ? 5 + index % 4 : (index * 7) % 3;
    const value = produce * 3.2 + dairy * 2.6 + bakery * 2.1 + meat * 6.5 + snacks * 1.8 + household * 4.4;
    return {
      basket_id: index + 1,
      produce,
      dairy,
      bakery,
      meat,
      snacks,
      household,
      basket_value: Number(value.toFixed(2)),
      segment: ['fresh-focused', 'family-dairy', 'snack-heavy', 'pantry-stock'][segmentId],
    };
  }),
};

export const newsTopicDataset: Dataset = {
  id: 'news-topics',
  name: 'News Topic Text Dataset',
  description: 'Short labeled article snippets for text classification, TF-IDF, embeddings, and transformer attention.',
  type: 'nlp',
  columns: ['text', 'label'],
  data: [
    { text: 'The central bank held rates steady while inflation cooled across services.', label: 'business' },
    { text: 'Quarterly revenue climbed after cloud subscriptions beat analyst expectations.', label: 'business' },
    { text: 'A new battery chemistry promises faster charging for electric vehicles.', label: 'technology' },
    { text: 'Researchers released an open model for efficient on-device translation.', label: 'technology' },
    { text: 'The home side won the final after a late goal in extra time.', label: 'sports' },
    { text: 'The rookie guard scored thirty points and led the comeback.', label: 'sports' },
    { text: 'Doctors reported improved outcomes from an early screening program.', label: 'health' },
    { text: 'Daily walking and sleep quality were linked to lower cardiac risk.', label: 'health' },
    { text: 'The studio announced a sequel after the film topped weekend charts.', label: 'entertainment' },
    { text: 'A streaming drama earned awards for writing and production design.', label: 'entertainment' },
    { text: 'Chip makers expanded fabrication capacity for AI accelerators.', label: 'technology' },
    { text: 'Exports rose as manufacturers recovered from supply delays.', label: 'business' },
    { text: 'The striker signed a long-term contract before the playoffs.', label: 'sports' },
    { text: 'Nutrition labels will be redesigned to highlight added sugar.', label: 'health' },
    { text: 'The festival lineup includes independent films and live concerts.', label: 'entertainment' },
  ],
};

export const productReviewsDataset: Dataset = {
  id: 'product-reviews',
  name: 'Product Reviews Sentiment Dataset',
  description: 'Short commerce reviews labeled by sentiment for NLP classification and recommendation content signals.',
  type: 'nlp',
  columns: ['text', 'label'],
  data: [
    { text: 'Battery life is excellent and the screen is bright outdoors.', label: 'positive' },
    { text: 'The case cracked after one week and support was slow.', label: 'negative' },
    { text: 'Setup was simple but the speakers are only average.', label: 'neutral' },
    { text: 'Great build quality, fast delivery, and worth the price.', label: 'positive' },
    { text: 'It overheats during normal use and feels unfinished.', label: 'negative' },
    { text: 'The design is clean though performance is just okay.', label: 'neutral' },
    { text: 'Camera quality surprised me in low light.', label: 'positive' },
    { text: 'The app disconnects often and loses saved settings.', label: 'negative' },
    { text: 'Packaging was fine and all accessories were included.', label: 'neutral' },
    { text: 'Excellent value for students and remote work.', label: 'positive' },
    { text: 'Buttons feel loose and the warranty process is confusing.', label: 'negative' },
    { text: 'Works as described with no major issues.', label: 'neutral' },
  ],
};

export function generateSyntheticBlobs(n = 100, k = 3): { x: number; y: number; label: number }[] {
  const centers = Array.from({ length: k }, (_, i) => ({
    cx: Math.cos((i * 2 * Math.PI) / k) * 3,
    cy: Math.sin((i * 2 * Math.PI) / k) * 3,
  }));
  return Array.from({ length: n }, () => {
    const label = Math.floor(Math.random() * k);
    const { cx, cy } = centers[label];
    return { x: cx + (Math.random() - 0.5) * 2, y: cy + (Math.random() - 0.5) * 2, label };
  });
}

export function generateSyntheticMoons(n = 100): { x: number; y: number; label: number }[] {
  const half = Math.floor(n / 2);
  const result: { x: number; y: number; label: number }[] = [];
  for (let i = 0; i < half; i++) {
    const angle = (Math.PI * i) / half;
    result.push({ x: Math.cos(angle) + (Math.random() - 0.5) * 0.3, y: Math.sin(angle) + (Math.random() - 0.5) * 0.3, label: 0 });
  }
  for (let i = 0; i < n - half; i++) {
    const angle = (Math.PI * i) / (n - half);
    result.push({ x: 1 - Math.cos(angle) + (Math.random() - 0.5) * 0.3, y: 0.5 - Math.sin(angle) + (Math.random() - 0.5) * 0.3, label: 1 });
  }
  return result;
}

export function generateSyntheticCircles(n = 100): { x: number; y: number; label: number }[] {
  const result: { x: number; y: number; label: number }[] = [];
  for (let i = 0; i < n; i++) {
    const label = i % 2;
    const r = label === 0 ? 1 : 2.5;
    const angle = Math.random() * 2 * Math.PI;
    result.push({ x: r * Math.cos(angle) + (Math.random() - 0.5) * 0.2, y: r * Math.sin(angle) + (Math.random() - 0.5) * 0.2, label });
  }
  return result;
}

export function generateLinearData(n = 50, slope = 2, intercept = 5, noise = 1): { x: number; y: number }[] {
  return Array.from({ length: n }, () => {
    const x = Math.random() * 10;
    return { x: parseFloat(x.toFixed(2)), y: parseFloat((slope * x + intercept + (Math.random() - 0.5) * noise * 5).toFixed(2)) };
  });
}

export const allSampleDatasets: Dataset[] = [
  irisDataset,
  housingDataset,
  studentMarksDataset,
  mallCustomersDataset,
  retailBasketDataset,
  timeSeriesSalesDataset,
  weatherDailyDataset,
  sensorAnomalyDataset,
  sentimentDataset,
  spamDataset,
  newsTopicDataset,
  productReviewsDataset,
  ratingsDataset,
  loanDataset,
  customerChurnDataset,
  medicalRiskDataset,
  fraudTransactionsDataset,
  energyDemandDataset,
];
