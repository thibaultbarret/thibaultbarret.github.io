; Injection de C++ dans tous les blocs de code MFront
;
; (#set! injection.include-children true) est indispensable :
; sans lui, le moteur d'injection exclut le texte des nœuds enfants nommés
; (les code_block imbriqués des if/else/for/…), ce qui produit un C++ fragmenté
; non parseable → aucun highlight C++ ne s'applique.

(includes_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(function_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(integrator_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(init_local_variables_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(initialize_local_variables_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(tangent_operator_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(prediction_operator_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(update_auxiliary_state_variables_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(compute_stress_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

(compute_final_stress_keyword
  (code_block) @injection.content
  (#set! injection.language "cpp")
  (#set! injection.include-children true))

; @FlowRule — nested {} (if/else/lambda…) inlined in flow_rule_block
(flow_rule_keyword
  (flow_rule_block
    (code_block) @injection.content
    (#set! injection.language "cpp")
    (#set! injection.include-children true)))

; @FlowRule — raw C++ lines (preparatory declarations, etc.)
(flow_rule_keyword
  (flow_rule_block
    (flow_cpp_code) @injection.content
    (#set! injection.language "cpp")))

; @FlowRule — RHS expressions (after '=')
(flow_rule_keyword
  (flow_rule_block
    (flow_rule_assignment
      (flow_expression) @injection.content
      (#set! injection.language "cpp"))))

; LaTeX dans les chaînes double-guillemets des blocs @Description
((description_latex) @injection.content
  (#set! injection.language "latex")
  (#offset! @injection.content 0 1 0 -1))
