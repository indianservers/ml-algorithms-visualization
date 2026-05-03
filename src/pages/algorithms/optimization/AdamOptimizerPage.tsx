import ConceptAlgorithmPage from '../shared/ConceptAlgorithmPage';

const config = {
  "chartKind": "line",
  "icon": "optimization",
  "title": "Adam Optimizer",
  "subtitle": "Interactive browser-only Adam Optimizer module with local datasets, controls, visualizations, metrics, and exports.",
  "category": "Optimization",
  "badge": "Intermediate",
  "explanation": "Adam Optimizer has a dedicated physical lazy-loaded page. It provides algorithm-specific controls, browser-local dataset input, visualization, metrics, prediction or inspection output, limitations, and export actions without Python, a backend, or cloud ML APIs.",
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
    "Prepare data for Adam Optimizer",
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
    "Use the controls to inspect Adam Optimizer outputs on new examples.",
    "Outputs are computed locally in the browser session."
  ],
  "chartTitle": "Adam Optimizer Visualization",
  "chartLabels": [
    "Input",
    "Step",
    "Model",
    "Metric",
    "Output",
    "Export"
  ],
  "modelOutput": [
    "Adam Optimizer parameters shown here",
    "intermediate values update per run",
    "predictions and reports are exportable"
  ],
  "warnings": [
    "Adam Optimizer is educational and browser-sized by default.",
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
    "does": "Runs and visualizes Adam Optimizer in the browser.",
    "when": "Use it when Adam Optimizer matches the learning or experimentation goal.",
    "math": "The page highlights the core formula, matrix, loss, distance, probability, or update rule used by Adam Optimizer.",
    "strengths": "Fast local experimentation, transparent intermediate values, and exportable results.",
    "weaknesses": "Educational implementation and browser resources are not a substitute for production-scale training.",
    "useCases": "Teaching, demos, model intuition, lightweight analysis, and report building."
  }
} as const;

export default function AdamOptimizerPage() {
  return <ConceptAlgorithmPage config={config} />;
}
