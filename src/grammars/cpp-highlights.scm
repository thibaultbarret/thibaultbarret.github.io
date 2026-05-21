; ── Comments ─────────────────────────────────────────────────────────────────
(comment) @comment

; ── Strings ──────────────────────────────────────────────────────────────────
(string_literal) @string
(raw_string_literal) @string

; ── Numbers ──────────────────────────────────────────────────────────────────
(number_literal) @number

; ── Function calls ────────────────────────────────────────────────────────────
; Appel simple : pow(...), exp(...), sqrt(...), etc.
(call_expression
  function: (identifier) @function)

; Appel qualifié : Stensor4::Id(), std::max(...), etc.
(call_expression
  function: (qualified_identifier
    name: (identifier) @function))

; Template : power<N>(x), etc.
(call_expression
  function: (template_function
    name: (identifier) @function))

(template_function
  name: (identifier) @function)

(template_method
  name: (field_identifier) @function.method)

; Déclarations de fonctions
(function_declarator
  declarator: (identifier) @function)

(function_declarator
  declarator: (qualified_identifier
    name: (identifier) @function))

(function_declarator
  declarator: (field_identifier) @function.method)

; ── Types ─────────────────────────────────────────────────────────────────────
; Types primitifs C++ (bool, char, double, float, int, …)
(primitive_type) @type.builtin

; auto
(placeholder_type_specifier) @type.builtin

; Identifiants de type utilisateur (ex: Stensor4, StressStensor, real)
(type_identifier) @type

; namespace_identifier commençant par majuscule : tfel, mfront, etc.
((namespace_identifier) @type
 (#match? @type "^[A-Z]"))

; ── Constantes / mots-clés valeurs ───────────────────────────────────────────
(this) @variable.builtin
(null) @constant.builtin
(true) @boolean
(false) @boolean

; ── Mots-clés de contrôle ────────────────────────────────────────────────────
[
 "break"
 "case"
 "continue"
 "default"
 "do"
 "else"
 "for"
 "goto"
 "if"
 "return"
 "switch"
 "while"
] @keyword.directive

; ── Mots-clés de déclaration / qualificateurs ────────────────────────────────
[
 "catch"
 "class"
 "co_await"
 "co_return"
 "co_yield"
 "const"
 "consteval"
 "constexpr"
 "constinit"
 "delete"
 "explicit"
 "extern"
 "final"
 "friend"
 "inline"
 "mutable"
 "namespace"
 "new"
 "noexcept"
 "operator"
 "override"
 "private"
 "protected"
 "public"
 "sizeof"
 "static"
 "struct"
 "template"
 "throw"
 "try"
 "typedef"
 "typename"
 "union"
 "using"
 "virtual"
 "volatile"
 "concept"
 "requires"
] @keyword.directive
