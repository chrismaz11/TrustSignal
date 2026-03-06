# Bias Report (Synthetic Deed Fraud Model)

Assessment scope: holdout split only, synthetic records only, no demographic attributes.

Conclusion: PASS (max metric gap <= 0.10 threshold).

## Notary Present Groups

```
                selection_rate  false_positive_rate  true_positive_rate
notary_present                                                         
absent                  0.4901               0.0146               0.980
present                 0.5102               0.0206               0.985
```

Metric gaps:
- selection_rate: 0.0200
- false_positive_rate: 0.0061
- true_positive_rate: 0.0050

## Days Since Notarized Buckets

```
                      selection_rate  false_positive_rate  true_positive_rate
days_since_notarized                                                         
1-90                          0.4794               0.0102              0.9583
181-270                       0.4973               0.0108              0.9891
271-365                       0.4976               0.0459              0.9804
91-180                        0.5238               0.0000              1.0000
```

Metric gaps:
- selection_rate: 0.0444
- false_positive_rate: 0.0459
- true_positive_rate: 0.0417
