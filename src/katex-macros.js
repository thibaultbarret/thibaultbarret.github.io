/**
 * KaTeX macros — traduction de cmdCommune.sty et MMC.sty
 *
 * Limitations KaTeX :
 *  - \ushort  → \underline (trait plus long qu'en LaTeX)
 *  - \Scale   → \scriptstyle pour les petits indices, symbole nu pour les grands
 *  - \stackunder + tilde → \underset{\sim}{...}
 *  - \textos (oldstyle) → chiffres normaux
 *  - \xspace → ignoré (inutile en HTML)
 */

export default {

  // ── cmdCommune.sty ─────────────────────────────────────────────────────────

  // Vecteurs (ushort + bold → underline + bold)
  "\\ve":           "\\underline{\\boldsymbol{#1}}",

  // Dérivée droite
  "\\der":          "\\mathrm{d}",

  // Dérivée partielle
  "\\dpar":         "\\dfrac{\\partial #1}{\\partial #2}",
  "\\dpartxt":      "\\frac{\\partial #1}{\\partial #2}",

  // Norme
  "\\normTwo":      "\\left\\lVert #1 \\right\\rVert_{2}",
  "\\normOne":      "\\left\\lVert #1 \\right\\rVert",

  // Opérateurs
  "\\std":          "\\operatorname{std}",
  "\\mean":         "\\operatorname{mean}",

  // Parenthèses / matrices
  "\\cosP":         "\\cos\\!\\left( #1 \\right)",
  "\\sinP":         "\\sin\\!\\left( #1 \\right)",
  "\\phantMinus":   "\\phantom{-}",
  "\\compVec":      "\\begin{Bmatrix} #1 \\end{Bmatrix}",
  "\\compMat":      "\\begin{bmatrix} #1 \\end{bmatrix}",

  // Strut (force hauteur de ligne)
  "\\mystrut":      "\\mathstrut",

  // Indices en scriptstyle (approx. \Scale[0.6]{...})
  "\\expInd":       "{\\scriptstyle\\mathrm{exp}}",
  "\\numInd":       "{\\scriptstyle\\mathrm{num}}",
  "\\feInd":        "{\\scriptstyle\\textsc{ef}}",
  "\\camInd":       "{\\scriptstyle\\mathrm{c}}",
  "\\retInd":       "{\\scriptstyle\\mathrm{ret}}",
  "\\imgInd":       "{\\scriptstyle\\mathrm{img}}",
  "\\objInd":       "{\\scriptstyle\\mathrm{obj}}",
  "\\mpInd":        "{\\scriptstyle\\mathrm{mp}}",
  "\\locInd":       "{\\scriptstyle\\mathrm{loc}}",
  "\\msrInd":       "{\\scriptstyle\\mathrm{msr}}",
  "\\extInd":       "{\\scriptstyle\\mathrm{ext}}",
  "\\intInd":       "{\\scriptstyle\\mathrm{int}}",

  // Statistiques
  "\\sigmaStat":    "\\sigma_{\\mathrm{stat}}",
  "\\muStat":       "\\mu_{\\mathrm{stat}}",

  // ── MMC.sty ────────────────────────────────────────────────────────────────

  // Tenseur ordre 2 : tilde sous le symbole
  // \st{X} → \underset{\sim}{\boldsymbol{X}}
  "\\st":           "\\underset{\\sim}{\\boldsymbol{#1}}",

  // Tenseur ordre 4 : double tilde sous le symbole
  // \stt{X} → \underset{\sim\\sim}{\boldsymbol{X}}
  // (MMC.sty utilisait \st[2]{X})
  "\\stt":          "\\underset{\\scriptstyle\\sim\\!\\sim}{\\boldsymbol{#1}}",

  // Versions pratiques avec bold pré-appliqué pour les tenseurs nommés
  // (le \Scale[1.4] est ignoré — pas de scaling arbitraire en KaTeX)
  "\\bSig":         "\\boldsymbol{\\sigma}",
  "\\bEps":         "\\boldsymbol{\\varepsilon}",

  // Configurations
  "\\configIni":    "\\Omega_{0}",
  "\\configT":      "\\Omega_{t}",

  // Corps physique
  "\\corpsM":       "\\mathcal{M}",
  "\\bordM":        "\\partial\\mathcal{M}",

  // Transformation
  "\\transfoPhi":   "\\underline{\\boldsymbol{\\phi}}",

  // Vecteurs MMC
  "\\vecEindice":   "\\underline{\\boldsymbol{e}}_{#1}",
  "\\ptx":          "\\underline{\\mathbf{x}}",
  "\\ptX":          "\\underline{\\mathbf{X}}",
  "\\vecU":         "\\underline{\\mathbf{u}}",
  "\\vecEigV":      "\\underline{\\mathcal{V}}",
  "\\vecEigU":      "\\underline{\\mathcal{U}}",

  // Tenseurs ordre 2 MMC
  "\\stId":         "\\underset{\\sim}{\\mathbf{I}}",
  "\\stU":          "\\underset{\\sim}{\\boldsymbol{U}}",
  "\\stV":          "\\underset{\\sim}{\\boldsymbol{V}}",
  "\\stC":          "\\underset{\\sim}{\\boldsymbol{C}}",
  "\\stB":          "\\underset{\\sim}{\\boldsymbol{B}}",
  "\\stR":          "\\underset{\\sim}{\\boldsymbol{R}}",
  "\\stF":          "\\underset{\\sim}{\\boldsymbol{F}}",
  "\\stX":          "\\underset{\\sim}{\\boldsymbol{X}}",

  // Opérateur gradient
  "\\opeGrad":      "\\underset{\\sim}{\\mathbf{Grad}}",
  "\\stGradU":      "\\underset{\\sim}{\\mathbf{Grad}}\\!\\left(\\underline{\\mathbf{u}}\\right)",

  // Tenseur des contraintes
  "\\stSig":        "\\underset{\\sim}{\\boldsymbol{\\sigma}}",
  "\\stSigIncN":    "\\underset{\\sim}{\\boldsymbol{\\sigma}}^{(n)}",
  "\\stSigIncNp":   "\\underset{\\sim}{\\boldsymbol{\\sigma}}^{(n+1)}",
  "\\stDeltaSig":   "\\Delta\\underset{\\sim}{\\boldsymbol{\\sigma}}",
  "\\stDeltaSigIncNp": "\\Delta\\underset{\\sim}{\\boldsymbol{\\sigma}}^{(n+1)}",
  "\\stSigComp":    "\\boldsymbol{\\sigma}_{\\!#1}",
  "\\stSigExpComp": "\\boldsymbol{\\sigma}^{\\mathrm{exp}}_{\\!#1}",
  "\\stSigNumComp": "\\boldsymbol{\\sigma}^{\\mathrm{num}}_{\\!#1}",
  "\\trStSig":      "\\operatorname{tr}\\!\\left(\\underset{\\sim}{\\boldsymbol{\\sigma}}\\right)",
  "\\stDevSig":     "\\underset{\\sim}{\\boldsymbol{s}}",
  "\\stFlow":       "\\underset{\\sim}{\\boldsymbol{n}}",
  "\\SigEqu":       "\\bar{\\boldsymbol{\\sigma}}",

  // Tenseur des déformations
  "\\stEps":        "\\underset{\\sim}{\\boldsymbol{\\varepsilon}}",
  "\\stEpsEl":      "\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{el}}",
  "\\stEpsPl":      "\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{pl}}",
  "\\stEpsExp":     "\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{exp}}",
  "\\stEpsNum":     "\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{num}}",
  "\\stEpsIncN":    "\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{(n)}",
  "\\stEpsTot":     "\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{tot}}",
  "\\stEpsComp":    "\\boldsymbol{\\varepsilon}_{\\!#1}",
  "\\stEpsCompExpo":"\\boldsymbol{\\varepsilon}^{#2}_{\\!#1}",
  "\\stEpsExpComp": "\\boldsymbol{\\varepsilon}^{\\mathrm{exp}}_{\\!#1}",
  "\\stEpsNumComp": "\\boldsymbol{\\varepsilon}^{\\mathrm{num}}_{\\!#1}",
  "\\trStEps":      "\\operatorname{tr}\\!\\left(\\underset{\\sim}{\\boldsymbol{\\varepsilon}}\\right)",
  "\\trStEpsEl":    "\\operatorname{tr}\\!\\left(\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{el}}\\right)",
  "\\stEpsI":       "\\boldsymbol{\\varepsilon}_{\\!{\\scriptstyle\\mathrm{I}}}",
  "\\stEpsII":      "\\boldsymbol{\\varepsilon}_{\\!{\\scriptstyle\\mathrm{II}}}",
  "\\stEpsIII":     "\\boldsymbol{\\varepsilon}_{\\!{\\scriptstyle\\mathrm{III}}}",
  "\\EpsPl":        "\\boldsymbol{\\varepsilon}_{\\mathrm{p}}",
  "\\EpsEquPl":     "\\bar{\\boldsymbol{\\varepsilon}}_{\\mathrm{p}}",
  "\\EpsEquPlDot":  "\\dot{\\bar{\\boldsymbol{\\varepsilon}}}_{\\mathrm{p}}",

  // Incréments de déformations
  "\\stDeltaEps":       "\\Delta\\underset{\\sim}{\\boldsymbol{\\varepsilon}}",
  "\\stDeltaEpsTot":    "\\Delta\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{tot}}",
  "\\stDeltaEpsEl":     "\\Delta\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{el}}",
  "\\stDeltaEpsVp":     "\\Delta\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{vp}}",
  "\\stDeltaEpsP":      "\\Delta\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{\\mathrm{p}}",
  "\\stDeltaEpsIncNp":  "\\Delta\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{(n+1)}",

  // Tenseurs ordre 4
  "\\sttC":   "\\underset{\\scriptstyle\\sim\\!\\sim}{\\boldsymbol{C}}",
  "\\sttL":   "\\underset{\\scriptstyle\\sim\\!\\sim}{\\boldsymbol{L}}",
  "\\sttK":   "\\underset{\\scriptstyle\\sim\\!\\sim}{\\boldsymbol{K}}",
  "\\sttId":  "\\underset{\\scriptstyle\\sim\\!\\sim}{\\mathbf{I}}",
  "\\sttH":   "\\underset{\\scriptstyle\\sim\\!\\sim}{\\mathbf{H}}",

  // LDC
  "\\dStSigdStEps":       "\\dfrac{\\partial\\Delta\\underset{\\sim}{\\boldsymbol{\\sigma}}}{\\partial\\Delta\\underset{\\sim}{\\boldsymbol{\\varepsilon}}}",
  "\\dStSigdStEpsIncNp":  "\\dfrac{\\partial\\Delta\\underset{\\sim}{\\boldsymbol{\\sigma}}^{(n+1)}}{\\partial\\Delta\\underset{\\sim}{\\boldsymbol{\\varepsilon}}^{(n+1)}}",

  "\\epsiZero":   "\\boldsymbol{\\varepsilon}_{0}",
  "\\epsiVM":     "\\boldsymbol{\\varepsilon}_{\\mathrm{vm}}",
  "\\sigmaZero":  "\\boldsymbol{\\sigma}_{0}",
  "\\sigmaVM":    "\\bar{\\boldsymbol{\\sigma}}",
  "\\sigmaR":     "\\boldsymbol{\\sigma}_{R}",
  "\\sigmaInf":   "\\boldsymbol{\\sigma}_{\\infty}",
  "\\sigmaEqu":   "\\bar{\\boldsymbol{\\sigma}}",
  "\\SigEqu":     "\\bar{\\boldsymbol{\\sigma}}",

  "\\pIncN":      "p^{(n)}",
  "\\pIncNp":     "p^{(n+1)}",

  "\\dChardx":    "\\dfrac{\\partial P}{\\partial x}",
};
