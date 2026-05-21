; MFront syntax highlighting
; Capture names follow the tree-sitter standard (nvim-treesitter / Helix compatible)

; ── Comments ──────────────────────────────────────────────────────────────────
(comment) @comment

; ── Strings ───────────────────────────────────────────────────────────────────
(string) @string

; ── Numeric literals ──────────────────────────────────────────────────────────
(integer_literal) @number
(real_literal)    @number.float

; ── Metadata — mots-clés @ ────────────────────────────────────────────────────
"@DSL"         @keyword.directive
"@Parser"      @keyword.directive
(dsl_keyword   name: (dsl_name) @type)
(parser_keyword name: (dsl_name) @type)
"@Author"      @keyword.directive
"@Date"        @keyword.directive
"@Description" @keyword.directive
"@Material"    @keyword.directive

; ── Mots-clés communs à tous les DSL mfront ───────────────────────────────────
"@UnitSystem"       @keyword.directive
"@Interface"        @keyword.directive
"@Behaviour"          @keyword.directive
"@OrthotropicBehaviour" @keyword.directive
"@Parameter"        @keyword.directive
"@Constant"         @keyword.directive
"@StaticVariable"   @keyword.directive
"@StaticVar"        @keyword.directive
"@TFELLibraries"    @keyword.directive
"@MaterialProperty"         @keyword.directive
"@MaterialLaw"              @keyword.directive
"@Model"                    @keyword.directive
"@Coef"                     @keyword.directive
"@LocalParameter"           @keyword.directive
"@ConstantMaterialProperty" @keyword.directive
"@Domain"                   @keyword.directive
"@Domains"                  @keyword.directive
"@Import"           @keyword.directive
"@Link"             @keyword.directive

; ── StateVariable ───────────────────────────────────────────────────────────
"@StateVariable"    @keyword.directive
(state_variable_keyword type: (mfront_builtin_type) @type)
(state_variable_keyword name: (identifier) @variable)

; ── MaterialLaw DSL ───────────────────────────────────────────────────────────
"@Law"            @keyword.directive
"@Library"        @keyword.directive
"@MFront"         @keyword.directive
"@Input"          @keyword.directive
"@Output"         @keyword.directive
"@Bounds"         @keyword.directive
"@PhysicalBounds" @keyword.directive
"@Function"       @keyword.directive
(function_keyword name: (identifier) @function)
"@Data"           @keyword.directive

; ── Implicit DSL ──────────────────────────────────────────────────────────────
"@StrainMeasure"             @keyword.directive
"@UseQt"                     @keyword.directive
"@Epsilon"                   @keyword.directive
"@Theta"                     @keyword.directive
"@Algorithm"                 @keyword.directive
"@StateVariable"             @keyword.directive
"@StateVar"                  @keyword.directive
"@AuxiliaryStateVariable"    @keyword.directive
"@AuxiliaryStateVar"         @keyword.directive
"@LocalVariable"             @keyword.directive
"@LocalVar"                  @keyword.directive
"@ExternalStateVariable"     @keyword.directive
"@ExternalStateVar"          @keyword.directive
"@ModellingHypotheses"       @keyword.directive
"@ModellingHypothesis"       @keyword.directive
"@Includes"                  @keyword.directive
"@InitLocalVariables"        @keyword.directive
"@InitLocalVars"             @keyword.directive
"@ComputeStress"             @keyword.directive
"@ComputeFinalStress"        @keyword.directive
"@Integrator"                @keyword.directive
"@TangentOperator"           @keyword.directive
"@PredictionOperator"                        @keyword.directive
"@UpdateAuxiliaryStateVariables"             @keyword.directive
"@UpdateAuxiliaryStateVars"                  @keyword.directive
"@FlowRule"                            @keyword.directive
"@ElasticMaterialProperties" @keyword.directive
"@InitializeLocalVariables"  @keyword.directive

; ── Bricks ────────────────────────────────────────────────────────────────────
"@Brick"              @keyword.directive

; ── Nom du DSL (@DSL Implicit) ────────────────────────────────────────────────
(dsl_keyword name: (dsl_name) @type)

; ── Noms de comportement et de loi (@Behaviour, @Law) ─────────────────────────
(behaviour_keyword name: (identifier) @type.definition)
(law_keyword       name: (identifier) @type.definition)

; ── Noms de matériau et de matériaux ──────────────────────────────────────────
(material_keyword name: (identifier) @type.definition)

; ── Types MFront connus (scalaires, vecteurs, tenseurs…) ──────────────────────
; Colorés en @type.builtin quelle que soit la position où ils apparaissent.
(mfront_scalar_type)  @type.builtin
(mfront_builtin_type) @type.builtin

; ── derivative_type<T, D1, D2, …> ────────────────────────────────────────────
"derivative_type"                                    @type.builtin
(derivative_type numerator:  (mfront_builtin_type)  @type.builtin)
(derivative_type numerator:  (identifier)           @type)
(derivative_type denominator: (mfront_builtin_type) @type.builtin)
(derivative_type denominator: (identifier)          @type)

; ── Types dans les déclarations de variables (fallback : type utilisateur) ────
(state_variable_keyword           type: (identifier) @type)
(auxiliary_state_variable_keyword type: (identifier) @type)
(local_variable_keyword           type: (identifier) @type)
(external_state_variable_keyword  type: (identifier) @type)
(parameter_keyword                type: (identifier) @type)
; (input_keyword                    type: (identifier) @type)
; @Output: type limité à mfront_scalar_type pour éviter l'ambiguïté avec le name

; ── Noms de variables ─────────────────────────────────────────────────────────
(state_variable_keyword           name: (identifier) @variable)
(auxiliary_state_variable_keyword name: (identifier) @variable)
(local_variable_keyword           name: (identifier) @variable)
(external_state_variable_keyword  name: (identifier) @variable)
(material_property_keyword        type: (mfront_scalar_type) @type)
(material_property_keyword        names: (material_property_names_multi (identifier) @variable))
(material_property_keyword        name: (identifier) @variable)
(material_property_keyword        dimension: (integer_literal) @number)
(input_keyword                    name: (identifier) @variable)
(output_keyword                   name: (identifier) @variable)
(parameter_keyword                name: (identifier) @variable)

; ── Métadonnées textuelles ────────────────────────────────────────────────────
(author_keyword name: (free_text) @label)
(date_keyword   date: (free_text) @label)

; ── @Description — texte du bloc { ... } ─────────────────────────────────────
; @Description n'accepte que la forme bloc ; les accolades sont capturées par
; la règle générale @punctuation.bracket ci-dessous.
(description_keyword (description_block (description_text)  @label))
(description_keyword (description_block (description_latex) @string.special))

; ── @Data (MaterialLaw) ───────────────────────────────────────────────────────
(data_option key:   (identifier)                     @property)
(data_option value: (string)                         @string)
(data_option value: "true"                           @boolean)
(data_option value: "false"                          @boolean)
(data_option value: (signed_number (real_literal)   ) @number.float)
(data_option value: (signed_number (integer_literal)) @number)
(data_map_entry key: (signed_number (real_literal)   ) @number.float)
(data_map_entry key: (signed_number (integer_literal)) @number)
(data_map_entry val: (signed_number (real_literal)   ) @number.float)
(data_map_entry val: (signed_number (integer_literal)) @number)

; ── Bornes (MaterialLaw) ──────────────────────────────────────────────────────
(bounds_keyword          variable: (identifier) @variable)
(physical_bounds_keyword variable: (identifier) @variable)
"in" @keyword.operator
"*"  @constant.builtin
(bounds_interval open:  _ @punctuation.bracket)
(bounds_interval close: _ @punctuation.bracket)
":"  @punctuation.delimiter

; ── Modelling hypotheses ──────────────────────────────────────────────────────
(modelling_hypotheses_keyword (modelling_hypothesis_value) @constant)
(modelling_hypotheses_keyword (string) @string)
(modelling_hypothesis_keyword (modelling_hypothesis_value) @constant)

; ── Ponctuation générale ──────────────────────────────────────────────────────
";" @punctuation.delimiter
"{" @punctuation.bracket
"}" @punctuation.bracket

; ── Valeurs numériques dans les déclarations ──────────────────────────────────
; signed_number captures the whole span including the optional '-' sign.
(signed_number (real_literal)    ) @number.float
(signed_number (integer_literal) ) @number

; ── Initialiseurs de tableau ───────────────────────────────────────────────────
(array_initializer (signed_number (real_literal)   ) @number.float)
(array_initializer (signed_number (integer_literal)) @number)

; ── Bricks ────────────────────────────────────────────────────────────────────
(brick_keyword   name:  (string)     @string)
(brick_keyword   name:  (identifier) @type.definition)
(brick_parameter key:   (identifier) @property)
(brick_parameter model: (string)     @string)
(brick_parameter value: (signed_number (real_literal)   ) @number.float)
(brick_parameter value: (signed_number (integer_literal)) @number)

; ── ElasticMaterialProperties ─────────────────────────────────────────────────
(elastic_material_properties_keyword property: (identifier) @variable)
(elastic_material_properties_keyword value: (signed_number (real_literal)   ) @number.float)
(elastic_material_properties_keyword value: (signed_number (integer_literal)) @number)
(elastic_material_properties_keyword value: (string) @string)
(elastic_property_assignment property: (identifier) @property)
(elastic_property_assignment value: (signed_number (real_literal)   ) @number.float)
(elastic_property_assignment value: (signed_number (integer_literal)) @number)
(elastic_property_assignment value: (string) @string)

; ── Attributs de variables — T.setGlossaryName("Temperature"); ───────────────
(variable_attribute variable: (identifier)    @variable)
(variable_attribute method:   (attribute_method) @function.method)
"." @punctuation.delimiter
(variable_attribute value: (string)                                @string)
(variable_attribute value: (signed_number (real_literal)   )       @number.float)
(variable_attribute value: (signed_number (integer_literal))       @number)

; ── Constantes ────────────────────────────────────────────────────────────────
(constant_keyword name:  (identifier)                    @constant)
(constant_keyword value: (signed_number (real_literal)   ) @number.float)
(constant_keyword value: (signed_number (integer_literal)) @number)

; ── StaticVariable / StaticVar ───────────────────────────────────────────────
(static_variable_keyword type: (mfront_scalar_type)          @type)
(static_variable_keyword name: (identifier)                  @constant)
(static_variable_keyword value: (signed_number (real_literal)   ) @number.float)
(static_variable_keyword value: (signed_number (integer_literal)) @number)
(static_var_keyword type: (mfront_scalar_type)               @type)
(static_var_keyword name: (identifier)                       @constant)
(static_var_keyword value: (signed_number (real_literal)   ) @number.float)
(static_var_keyword value: (signed_number (integer_literal)) @number)

; ── UseQt — booléen ───────────────────────────────────────────────────────────
(use_qt_keyword value: _ @boolean)

; ── UnitSystem ────────────────────────────────────────────────────────────────
(unit_system_keyword value: _ @constant)

; ── Interface ────────────────────────────────────────────────────────────────
(interface_keyword value: (interface_value) @constant)

; ── OrthotropicBehaviour ───────────────────────────────────────────────────────
(orthotropic_behaviour_keyword convention: (orthotropic_convention) @constant)

; ── StrainMeasure ──────────────────────────────────────────────────────────────
(strain_measure_keyword value: (strain_measure_value) @constant)
(strain_measure_option key:   (identifier) @property)
(strain_measure_option value: "true"       @boolean)
(strain_measure_option value: "false"      @boolean)

; ── Algorithm — valeur colorée différemment ───────────────────────────────────
(algorithm_keyword value: (algorithm_value) @constant)

; ── FlowRule — cibles d'affectation et invariants de contrainte ───────────────
(flow_rule_keyword type: (flow_rule_type) @constant)  ; Plasticity, Creep, …
(flow_rule_variable) @variable.builtin  ; f, df_dseq, df_dp
(flow_predefined)    @variable.builtin  ; seq, seqe

; ── Variables prédéfinies MFront ─────────────────────────────────────────────
; Disponibles dans tous les DSL : t (temps courant), dt (incrément de temps)
(mfront_global_var) @variable.builtin
; Disponibles dans le DSL Implicit : sig, eel, deel
(mfront_implicit_var) @variable.builtin
