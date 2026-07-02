# Debug Session: folder-dnd-admin
- **Status**: [OPEN]
- **Issue**: Le drag and drop des dossiers ne fonctionne toujours pas dans l'admin, en particulier dans `Portfolio 2`.
- **Debug Server**: Pending startup
- **Log File**: .dbg/trae-debug-log-folder-dnd-admin.ndjson

## Reproduction Steps
1. Ouvrir `admin.html`.
2. Se connecter puis basculer sur `Portfolio 2`.
3. Depuis la vue racine des dossiers, tenter de glisser un dossier pour changer son ordre.
4. Vérifier si la carte suit le pointeur, si un état de tri apparaît, et si l'ordre final persiste.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `Sortable` est initialisé mais reste désactivé au moment du drag. | High | Low | Pending |
| B | Le drag démarre, mais `oldIndex/newIndex` ne changent jamais. | High | Low | Pending |
| C | Un rerender ou une ouverture de dossier annule le drag avant la sauvegarde. | Med | Med | Pending |
| D | La requête de reorder part avec un mauvais `portfolio` ou un mauvais `parentFolder`. | Med | Med | Pending |
| E | La sauvegarde aboutit mais le rechargement réinjecte un ordre différent. | Med | Med | Pending |

## Log Evidence
- Pending

## Verification Conclusion
- Pending
