---
"actions-ecr": major
---

Make `appName` a required input.

Previously, `appName` was optional and defaulted to the GitHub repository name. 
Setting `appName` as required makes it explicit which image is being pushed/pulled. 
