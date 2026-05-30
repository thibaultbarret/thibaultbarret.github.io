---
title: "Implémentation de loi de comportement thermomécanique avec le générateur de code MFront"
slug: "loi-comportement-mfront"
description: ""
figure: ""
tags: ["Loi de comportement thermomécanique", "MFront", "MTest", "Abaqus"]
status: "en cours"
order: 0
show: true
---

# Introduction

<!-- MFront est un générateur de code pour les lois de comportement. -->

# Implémentation de loi de comportement élastoplastique isotrope

## Implémentation MFront

L'implémentation de loi de comportement élastoplastique isotrope peut être facilement réalisée en utilisant le `@DSL IsotropicPlasticMisesFlow`.

```mfront
@DSL IsotropicPlasticMisesFlow ;
@Author Thibault BARRET ;
@Date 15/06/2024 ;
@Description{
    Implémentation de la loi de comportement élastoplastique isotrope.
    Élasticite linéaire isotrope
    Écrouissage isotrope modélisé par la combinaison des loi de Swift et Voce
}

@ElasticMaterialProperties{209990, 0.3}

@MaterialProperty real coefAlpha ;
@MaterialProperty stress coefK ;
@MaterialProperty real expN ;
@MaterialProperty stress sigmaZero ;

@MaterialProperty stress sigmaInf ;
@MaterialProperty real expQ ;


@LocalVariable strain epsilonZero ;

@InitializeLocalVariables{
    epsilonZero = pow(sigmaZero/coefK, 1./expN) ;
}


@FlowRule {
    f = seq - (
        coefAlpha * (coefK * pow(epsilonZero + p, expN)) // Swift
        +
        (1. - coefAlpha) * (sigmaZero + sigmaInf*(1. - exp(-expQ*p))) // Voce
        ) ;

    df_dseq = 1. ; // ∂f\∂σ
    df_dp = pAlpha*coefK*expN*pow(epsiZero+p, expN-1) - (1-pAlpha)*expQ*sigmaInf*exp(-expQ*p) // ∂f/∂p
}

```

## Validation dans MTest

<!-- const auto dR_dp = -->
<!-- f = seq - R ; -->

<!-- # Implémentation de loi de comportement viscoplastique isotrope -->
