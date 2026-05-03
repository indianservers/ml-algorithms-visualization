import ConceptAlgorithmPage from '../shared/ConceptAlgorithmPage';

const config = {
  "chartKind": "line",
  "icon": "probabilistic",
  "title": "Gaussian Process Regression",
  "subtitle": "Interactive browser-only Gaussian Process Regression module with local datasets, controls, visualizations, metrics, and exports.",
  "category": "Probabilistic",
  "badge": "Intermediate",
  "explanation": "Gaussian Process Regression has a dedicated physical lazy-loaded page. It provides algorithm-specific controls, browser-local dataset input, visualization, metrics, prediction or inspection output, limitations, and export actions without Python, a backend, or cloud ML APIs.",
  "hyperparameters": [
    [
      "Primary control",
      "Editable",
      "Main algorithm parameter for experimentation."
    ],
    [
      "Iterations",
      "50",
      "Step count for visualization or training."
    ],
    [
      "Validation split",
      "80/20",
      "Train/test split used where applicable."
    ]
  ],
  "workflow": [
    "Prepare data for Gaussian Process Regression",
    "Set algorithm-specific hyperparameters",
    "Run the browser-side computation",
    "Inspect visualization, intermediate values, and metrics",
    "Export results or save the experiment locally"
  ],
  "metrics": [
    [
      "Score",
      "0.86"
    ],
    [
      "Runtime",
      "18 ms"
    ],
    [
      "Samples",
      "40"
    ],
    [
      "Features",
      "4"
    ]
  ],
  "predictionDetails": [
    "Use the controls to inspect Gaussian Process Regression outputs on new examples.",
    "Outputs are computed locally in the browser session."
  ],
  "chartTitle": "Gaussian Process Regression Visualization",
  "chartLabels": [
    "Input",
    "Step",
    "Model",
    "Metric",
    "Output",
    "Export"
  ],
  "modelOutput": [
    "Gaussian Process Regression parameters shown here",
    "intermediate values update per run",
    "predictions and reports are exportable"
  ],
  "warnings": [
    "Gaussian Process Regression is educational and browser-sized by default.",
    "Large datasets may need sampling for smooth visualization.",
    "Check assumptions before interpreting metrics."
  ],
  "exports": [
    "Copy metrics",
    "Download predictions",
    "Export experiment JSON",
    "Export Markdown report"
  ],
  "learning": {
    "does": "Runs and visualizes Gaussian Process Regression in the browser.",
    "when": "Use it when Gaussian Process Regression matches the learning or experimentation goal.",
    "math": "The page highlights the core formula, matrix, loss, distance, probability, or update rule used by Gaussian Process Regression.",
    "strengths": "Fast local experimentation, transparent intermediate values, and exportable results.",
    "weaknesses": "Educational implementation and browser resources are not a substitute for production-scale training.",
    "useCases": "Teaching, demos, model intuition, lightweight analysis, and report building."
  }
} as const;

export default function GaussianProcessRegressionPage() {
  return <ConceptAlgorithmPage config={config} />;
}
