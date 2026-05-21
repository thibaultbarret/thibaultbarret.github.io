; MTest syntax highlighting
; Capture names follow the tree-sitter standard (nvim-treesitter / Helix compatible)

; ── Comments ──────────────────────────────────────────────────────────────────
(comment) @comment

; ── Strings ───────────────────────────────────────────────────────────────────
(string) @string

; ── Métadonnées ───────────────────────────────────────────────────────────────
"@Author"      @keyword.directive
"@Date"        @keyword.directive
"@Description" @keyword.directive
"@Material"    @keyword.directive

; ── MaterialProperty ──────────────────────────────────────────────────────────
"@MaterialProperty" @keyword.directive
(material_property_keyword type: (material_property_type) @constant)
(material_property_keyword name: (string) @string)
(material_property_keyword value: (signed_number (real_literal)   ) @number.float)
(material_property_keyword value: (signed_number (integer_literal)) @number)
(material_property_keyword value: (string) @string)

; ── RotationMatrix ────────────────────────────────────────────────────────────
"@RotationMatrix" @keyword.directive
(rotation_matrix_keyword type: (rotation_matrix_type) @constant)
(rotation_scalar (real_literal)    @number.float)
(rotation_scalar (integer_literal) @number)
(rotation_scalar (identifier)      @variable)

; ── PredictionPolicy ──────────────────────────────────────────────────────────
"@PredictionPolicy" @keyword.directive
(prediction_policy_keyword value: (prediction_policy_value) @constant)

; ── AccelerationAlgorithm ─────────────────────────────────────────────────────
"@AccelerationAlgorithm" @keyword.directive
(acceleration_algorithm_keyword value: (string) @string)

; ── ModellingHypothesis ───────────────────────────────────────────────────────
"@ModellingHypothesis" @keyword.directive
(modelling_hypothesis_keyword hypothesis: (string) @string)

; ── Behaviour ─────────────────────────────────────────────────────────────────
"@Behaviour"    @keyword.directive
"<"             @punctuation.bracket
">"             @punctuation.bracket
(behaviour_keyword interface: (behaviour_interface) @constant)
(behaviour_keyword library:   (string)              @string)
(behaviour_keyword function:  (string)              @function)

; ── Nom du matériau ───────────────────────────────────────────────────────────
(material_keyword name: (identifier) @variable)

; ── Métadonnées textuelles ────────────────────────────────────────────────────
(author_keyword name: (free_text) @label)
(date_keyword   date: (free_text) @label)

; ── Contenu du bloc @Description ─────────────────────────────────────────────
(description_keyword (description_block (description_text)  @label))
(description_keyword (description_block (description_latex) @string.special))

; ── ImposedStress ─────────────────────────────────────────────────────────────
"@ImposedStress" @keyword.directive
(imposed_stress_keyword evolution_type: (loading_evolution_type) @constant)
(imposed_stress_keyword component:      (stress_component)       @variable.builtin)
(imposed_stress_keyword value: (real_literal)                    @number.float)
(imposed_stress_keyword value: (integer_literal)                 @number)
(imposed_stress_keyword value: (string)                          @string.special)

; ── ImposedDeformationGradient ────────────────────────────────────────────────
"@ImposedDeformationGradient" @keyword.directive
(imposed_deformation_gradient_keyword evolution_type: (loading_evolution_type) @constant)
(imposed_deformation_gradient_keyword component:      (deformation_gradient_component) @variable.builtin)
(imposed_deformation_gradient_keyword value: (real_literal)                    @number.float)
(imposed_deformation_gradient_keyword value: (integer_literal)                 @number)
(imposed_deformation_gradient_keyword value: (string)                          @string.special)

; ── Stress ────────────────────────────────────────────────────────────────────
"@Stress" @keyword.directive
(stress_array (string)                           @string.special)
(stress_array (signed_number (real_literal))     @number.float)
(stress_array (signed_number (integer_literal))  @number)

; ── Strain ────────────────────────────────────────────────────────────────────
"@Strain" @keyword.directive
(strain_array component: (signed_number (real_literal))    @number.float)
(strain_array component: (signed_number (integer_literal)) @number)

; ── ImposedStrain ─────────────────────────────────────────────────────────────
"@ImposedStrain" @keyword.directive
(imposed_strain_keyword evolution_type: (loading_evolution_type) @constant)
(imposed_strain_keyword component:      (strain_component)       @variable.builtin)
(imposed_strain_keyword value: (real_literal)                    @number.float)
(imposed_strain_keyword value: (integer_literal)                 @number)
(imposed_strain_keyword value: (string)                          @string.special)

; ── ImposedThermodynamicForce ────────────────────────────────────────────────
"@ImposedThermodynamicForce" @keyword.directive
(imposed_thermodynamic_force_keyword name:  (string) @string)
(imposed_thermodynamic_force_keyword value: (string) @string.special)

; ── DrivingVariable ──────────────────────────────────────────────────────────
"@DrivingVariable" @keyword.directive
(driving_variable_array component: (signed_number (real_literal))    @number.float)
(driving_variable_array component: (signed_number (integer_literal)) @number)

; ── ImposedDrivingVariable ───────────────────────────────────────────────────
"@ImposedDrivingVariable" @keyword.directive
(imposed_driving_variable_keyword evolution_type: (loading_evolution_type) @constant)
(imposed_driving_variable_keyword name:           (string)                 @string)
(imposed_driving_variable_keyword value: (real_literal)                    @number.float)
(imposed_driving_variable_keyword value: (integer_literal)                 @number)
(imposed_driving_variable_keyword value: (string)                          @string.special)

; ── Times ─────────────────────────────────────────────────────────────────────
"@Times" @keyword.directive
"in"     @keyword.operator
(times_entry time:  (real_literal)    @number.float)
(times_entry time:  (integer_literal) @number)
(times_entry steps: (integer_literal) @number)

; ── Real constant ─────────────────────────────────────────────────────────────
"@Real" @keyword.directive
(real_keyword name:  (string)          @variable)
(signed_number (real_literal)    ) @number.float
(signed_number (integer_literal) ) @number

; ── ExternalStateVariable ─────────────────────────────────────────────────────
"@ExternalStateVariable" @keyword.directive
(external_state_variable_keyword evolution_type: (esv_evolution_type) @constant)
(external_state_variable_keyword name:           (string)             @string)
(external_state_variable_keyword value: (real_literal)                @number.float)
(external_state_variable_keyword value: (integer_literal)             @number)
(external_state_variable_keyword value: (string)                      @string.special)
; time and value inside the evolution table
(evolution_entry time:  (real_literal)    @number.float)
(evolution_entry time:  (integer_literal) @number)
(evolution_entry value: (real_literal)    @number.float)
(evolution_entry value: (integer_literal) @number)

; ── Event ─────────────────────────────────────────────────────────────────────
"@Event" @keyword.directive
(event_keyword name: (string)                              @string)
(event_keyword time: (string)                              @string.special)
(event_keyword time: (signed_number (real_literal))        @number.float)
(event_keyword time: (signed_number (integer_literal))     @number)
(event_time_array time: (string)                           @string.special)
(event_time_array time: (signed_number (real_literal))     @number.float)
(event_time_array time: (signed_number (integer_literal))  @number)

; ── Evolution ─────────────────────────────────────────────────────────────────
"@Evolution" @keyword.directive
(evolution_keyword evolution_type: (loading_evolution_type) @constant)
(evolution_keyword name:  (string)           @string)
(evolution_keyword value: (real_literal)     @number.float)
(evolution_keyword value: (integer_literal)  @number)
(evolution_keyword value: (string)           @string.special)

; ── DeformationGradient ───────────────────────────────────────────────────────
"@DeformationGradient" @keyword.directive
(deformation_gradient_array (real_literal)     @number.float)
(deformation_gradient_array (integer_literal)  @number)

; ── AccelerationAlgorithmParameter ────────────────────────────────────────────
"@AccelerationAlgorithmParameter" @keyword.directive
(acceleration_algorithm_parameter_keyword name:  (string) @property)
(acceleration_algorithm_parameter_keyword value: (string) @string)

; ── CastemAccelerationPeriod ──────────────────────────────────────────────────
"@CastemAccelerationPeriod" @keyword.directive
(castem_acceleration_period_keyword value: (integer_literal) @number)

; ── CastemAccelerationTrigger ─────────────────────────────────────────────────
"@CastemAccelerationTrigger" @keyword.directive
(castem_acceleration_trigger_keyword value: (integer_literal) @number)

; ── ImposedCohesiveForce ─────────────────────────────────────────────────────
"@ImposedCohesiveForce" @keyword.directive
(imposed_cohesive_force_keyword (loading_evolution_type) @constant)
(imposed_cohesive_force_keyword (string)                 @string)
(imposed_cohesive_force_keyword (real_literal)           @number.float)
(imposed_cohesive_force_keyword (integer_literal)        @number)

; ── CohesiveForce ─────────────────────────────────────────────────────────────
"@CohesiveForce" @keyword.directive
(cohesive_force_array (real_literal)     @number.float)
(cohesive_force_array (integer_literal)  @number)
(cohesive_force_array (string)           @string)

; ── CohesiveForceEpsilon ──────────────────────────────────────────────────────
"@CohesiveForceEpsilon" @keyword.directive
(cohesive_force_epsilon_keyword value: (real_literal)     @number.float)
(cohesive_force_epsilon_keyword value: (integer_literal)  @number)

; ── ThermodynamicForce ────────────────────────────────────────────────────────
"@ThermodynamicForce" @keyword.directive
(thermodynamic_force_array (string)                          @string.special)
(thermodynamic_force_array (signed_number (real_literal))    @number.float)
(thermodynamic_force_array (signed_number (integer_literal)) @number)

; ── ThermodynamicForceEpsilon ─────────────────────────────────────────────────
"@ThermodynamicForceEpsilon" @keyword.directive
(thermodynamic_force_epsilon_keyword value: (real_literal)    @number.float)
(thermodynamic_force_epsilon_keyword value: (integer_literal) @number)

; ── CompareToNumericalTangentOperator ─────────────────────────────────────────
"@CompareToNumericalTangentOperator" @keyword.directive
(compare_to_numerical_tangent_operator_keyword value: _ @boolean)

; ── DynamicTimeStepScaling ────────────────────────────────────────────────────
"@DynamicTimeStepScaling" @keyword.directive
(dynamic_time_step_scaling_keyword value: _ @boolean)

; ── DeformationGradientEpsilon ────────────────────────────────────────────────
"@DeformationGradientEpsilon" @keyword.directive
(deformation_gradient_epsilon_keyword value: (real_literal) @number.float)
(deformation_gradient_epsilon_keyword value: (integer_literal) @number)

; ── StrainEpsilon ─────────────────────────────────────────────────────────────
"@StrainEpsilon" @keyword.directive
(strain_epsilon_keyword value: (real_literal) @number.float)
(strain_epsilon_keyword value: (integer_literal) @number)

; ── StressEpsilon ─────────────────────────────────────────────────────────────
"@StressEpsilon" @keyword.directive
(stress_epsilon_keyword value: (real_literal) @number.float)
(stress_epsilon_keyword value: (integer_literal) @number)

; ── MaximumNumberOfIterations ────────────────────────────────────────────────
"@MaximumNumberOfIterations" @keyword.directive
(maximum_number_of_iterations_keyword value: (integer_literal) @number)

; ── MaximumNumberOfSubSteps ──────────────────────────────────────────────────
"@MaximumNumberOfSubSteps" @keyword.directive
(maximum_number_of_substeps_keyword value: (integer_literal) @number)

; ── DrivingVariableEpsilon ───────────────────────────────────────────────────
"@DrivingVariableEpsilon" @keyword.directive
(driving_variable_epsilon_keyword value: (real_literal)    @number.float)
(driving_variable_epsilon_keyword value: (integer_literal) @number)

; ── MaximalTimeStep / MinimalTimeStep ─────────────────────────────────────────
"@MaximalTimeStep" @keyword.directive
(maximal_time_step_keyword value: (real_literal)    @number.float)
(maximal_time_step_keyword value: (integer_literal) @number)

"@MinimalTimeStep" @keyword.directive
(minimal_time_step_keyword value: (real_literal)    @number.float)
(minimal_time_step_keyword value: (integer_literal) @number)

; ── MaximalTimeStepScalingFactor / MinimalTimeStepScalingFactor ──────────────
"@MaximalTimeStepScalingFactor" @keyword.directive
(maximal_time_step_scaling_factor_keyword value: (real_literal)    @number.float)
(maximal_time_step_scaling_factor_keyword value: (integer_literal) @number)

"@MinimalTimeStepScalingFactor" @keyword.directive
(minimal_time_step_scaling_factor_keyword value: (real_literal)    @number.float)
(minimal_time_step_scaling_factor_keyword value: (integer_literal) @number)

; ── Message / Print ───────────────────────────────────────────────────────────
"@Message" @keyword.directive
(message_keyword value: (real_literal)    @number.float)
(message_keyword value: (integer_literal) @number)
(message_keyword value: (string)          @string.special)

"@Print" @keyword.directive
(print_keyword value: (real_literal)    @number.float)
(print_keyword value: (integer_literal) @number)
(print_keyword value: (string)          @string.special)

; ── NumericalTangentOperatorPerturbationValue ────────────────────────────────
"@NumericalTangentOperatorPerturbationValue" @keyword.directive
(numerical_tangent_operator_perturbation_value_keyword value: (real_literal)    @number.float)
(numerical_tangent_operator_perturbation_value_keyword value: (integer_literal) @number)

; ── TangentOperatorComparisonCriterium / Criterion ───────────────────────────
"@TangentOperatorComparisonCriterium" @keyword.directive
(tangent_operator_comparison_criterium_keyword value: (signed_number (real_literal))    @number.float)
(tangent_operator_comparison_criterium_keyword value: (signed_number (integer_literal)) @number)

"@TangentOperatorComparisonCriterion" @keyword.directive
(tangent_operator_comparison_criterion_keyword value: (signed_number (real_literal))    @number.float)
(tangent_operator_comparison_criterion_keyword value: (signed_number (integer_literal)) @number)

; ── ImposedGradient ──────────────────────────────────────────────────────────
"@ImposedGradient" @keyword.directive
(imposed_gradient_keyword evolution_type: (loading_evolution_type) @constant)
(imposed_gradient_keyword name:           (string)                 @string)
(imposed_gradient_keyword value: (real_literal)                    @number.float)
(imposed_gradient_keyword value: (integer_literal)                 @number)
(imposed_gradient_keyword value: (string)                          @string.special)

; ── Gradient ──────────────────────────────────────────────────────────────────
"@Gradient" @keyword.directive
(gradient_array (real_literal)    @number.float)
(gradient_array (integer_literal) @number)
(gradient_array (string)          @string)

; ── GradientEpsilon ───────────────────────────────────────────────────────────
"@GradientEpsilon" @keyword.directive
(gradient_epsilon_keyword value: (real_literal)    @number.float)
(gradient_epsilon_keyword value: (integer_literal) @number)

; ── ImposedOpeningDisplacement ───────────────────────────────────────────────
"@ImposedOpeningDisplacement" @keyword.directive
(imposed_opening_displacement_keyword evolution_type: (loading_evolution_type) @constant)
(imposed_opening_displacement_keyword name:           (string)                 @string)
(imposed_opening_displacement_keyword value: (real_literal)                    @number.float)
(imposed_opening_displacement_keyword value: (integer_literal)                 @number)
(imposed_opening_displacement_keyword value: (string)                          @string.special)

; ── OpeningDisplacement ───────────────────────────────────────────────────────
"@OpeningDisplacement" @keyword.directive
(opening_displacement_array (real_literal)    @number.float)
(opening_displacement_array (integer_literal) @number)
(opening_displacement_array (string)          @string)

; ── OpeningDisplacementEpsilon ────────────────────────────────────────────────
"@OpeningDisplacementEpsilon" @keyword.directive
(opening_displacement_epsilon_keyword value: (real_literal)    @number.float)
(opening_displacement_epsilon_keyword value: (integer_literal) @number)

; ── NonLinearConstraint ───────────────────────────────────────────────────────
"@NonLinearConstraint" @keyword.directive
(non_linear_constraint_keyword policy:     (non_linear_constraint_policy) @constant)
(non_linear_constraint_keyword expression: (string)                       @string.special)

; ── Model ────────────────────────────────────────────────────────────────────
"@Model" @keyword.directive
(model_keyword interface: (behaviour_interface) @constant)
(model_keyword library:   (string)             @string)
(model_keyword function:  (string)             @function)

; ── Import ───────────────────────────────────────────────────────────────────
"@Import" @keyword.directive
(import_keyword interface: (import_interface) @constant)
(import_keyword library:   (string)           @string)
(import_keyword function:  (string)           @function)

; ── StateVariable ────────────────────────────────────────────────────────────
"@StateVariable" @keyword.directive
(state_variable_keyword (string)                              @variable)
(state_variable_keyword (signed_number (real_literal))        @number.float)
(state_variable_keyword (signed_number (integer_literal))     @number)

; ── InternalStateVariable ────────────────────────────────────────────────────
"@InternalStateVariable" @keyword.directive
(internal_state_variable_keyword name: (string) @variable)
(internal_state_variable_keyword value: (signed_number (real_literal))    @number.float)
(internal_state_variable_keyword value: (signed_number (integer_literal)) @number)
(internal_state_variable_array (real_literal)    @number.float)
(internal_state_variable_array (integer_literal) @number)
(internal_state_variable_array (string)          @string)

; ── Parameter ────────────────────────────────────────────────────────────────
"@Parameter" @keyword.directive
(parameter_keyword name:  (string)                              @property)
(parameter_keyword value: (signed_number (real_literal))    @number.float)
(parameter_keyword value: (signed_number (integer_literal)) @number)

; ── UnsignedIntegerParameter ─────────────────────────────────────────────────
"@UnsignedIntegerParameter" @keyword.directive
(unsigned_integer_parameter_keyword name:  (string)          @property)
(unsigned_integer_parameter_keyword value: (integer_literal) @number)

; ── IntegerParameter ─────────────────────────────────────────────────────────
"@IntegerParameter" @keyword.directive
(integer_parameter_keyword name:  (string)          @property)
(integer_parameter_keyword value: (integer_literal) @number)

; ── OutputFile ────────────────────────────────────────────────────────────────
"@OutputFile" @keyword.directive
(output_file_keyword filename: (string) @string)

; ── OutputFilePrecision ───────────────────────────────────────────────────────
"@OutputFilePrecision" @keyword.directive
(output_file_precision_keyword precision: (integer_literal) @number)

; ── ResidualFile ─────────────────────────────────────────────────────────────
"@ResidualFile" @keyword.directive
(residual_file_keyword filename: (string) @string)

; ── ResidualFilePrecision ─────────────────────────────────────────────────────
"@ResidualFilePrecision" @keyword.directive
(residual_file_precision_keyword precision: (integer_literal) @number)

; ── OutputFrequency ───────────────────────────────────────────────────────────
"@OutputFrequency" @keyword.directive
(output_frequency_keyword frequency: (output_frequency_value) @constant)
(output_frequency_keyword frequency: (string)                 @string)

; ── XMLOutputFile ────────────────────────────────────────────────────────────
"@XMLOutputFile" @keyword.directive
(xml_output_file_keyword filename: (string) @string)

; ── UserDefinedPostProcessing ─────────────────────────────────────────────────
"@UserDefinedPostProcessing" @keyword.directive
(user_defined_post_processing_keyword file:      (string) @string)
(user_defined_post_processing_array   component: (string) @property)

; ── Test ─────────────────────────────────────────────────────────────────────
"@Test" @keyword.directive
(test_type)                                          @keyword.modifier
(test_keyword file:     (string)                     @string)
(test_keyword variable: (string)                     @variable)
(test_keyword formula:  (string)                     @string.special)
(test_keyword column:   (integer_literal)            @number)
(test_keyword criterion: (signed_number (real_literal))    @number.float)
(test_keyword criterion: (signed_number (integer_literal)) @number)
(test_map_entry variable: (string)                   @variable)
(test_map_entry value:    (string)                   @string.special)
(test_map_entry value:    (integer_literal)          @number)

; ── PrintLagrangeMultipliers ─────────────────────────────────────────────────
"@PrintLagrangeMultipliers" @keyword.directive
(print_lagrange_multipliers_keyword value: _ @boolean)

; ── HandleThermalExpansion ───────────────────────────────────────────────────
"@HandleThermalExpansion" @keyword.directive
(handle_thermal_expansion_keyword value: _ @boolean)

; ── UseCastemAccelerationAlgorithm ───────────────────────────────────────────
"@UseCastemAccelerationAlgorithm" @keyword.directive
(use_castem_acceleration_algorithm_keyword value: _ @boolean)

; ── StiffnessMatrixType ───────────────────────────────────────────────────────
"@StiffnessMatrixType" @keyword.directive
(stiffness_matrix_type_keyword type:   (stiffness_matrix_type_value) @constant)
(stiffness_matrix_type_keyword type:   (string)                      @string)

; ── StiffnessUpdatePolicy ─────────────────────────────────────────────────────
"@StiffnessUpdatePolicy" @keyword.directive
(stiffness_update_policy_keyword policy: (stiffness_update_policy_value) @constant)
(stiffness_update_policy_keyword policy: (string)                        @string)

; ── OutOfBoundsPolicy ─────────────────────────────────────────────────────────
"@OutOfBoundsPolicy" @keyword.directive
(out_of_bounds_policy_keyword policy: (out_of_bounds_policy_value) @constant)
(out_of_bounds_policy_keyword policy: (string)                     @string)

; ── Constraint options block ─────────────────────────────────────────────────
(constraint_option key:   (constraint_option_key) @property)
(constraint_option value: (string)                @string.special)
(constraint_option value: "true"                  @boolean)
(constraint_option value: "false"                 @boolean)
(constraint_event_array event: (string)           @string.special)

; ── Ponctuation générale ──────────────────────────────────────────────────────
";" @punctuation.delimiter
"{" @punctuation.bracket
"}" @punctuation.bracket
":" @punctuation.delimiter
