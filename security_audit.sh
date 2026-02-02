#!/bin/bash

# =============================================================================
# CYNA SECURITY AUDIT SCRIPT
# Script d'audit de sécurité automatisé
# =============================================================================

echo "🔍 CYNA SECURITY AUDIT - $(date)"
echo "=============================================="

# Couleurs pour l'affichage
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Fonction d'affichage des résultats
show_result() {
    local level=$1
    local message=$2
    case $level in
        "CRITICAL") echo -e "${RED}🚨 CRITIQUE: $message${NC}" ;;
        "HIGH") echo -e "${RED}⚠️  ÉLEVÉ: $message${NC}" ;;
        "MEDIUM") echo -e "${YELLOW}⚡ MOYEN: $message${NC}" ;;
        "LOW") echo -e "${YELLOW}💡 FAIBLE: $message${NC}" ;;
        "GOOD") echo -e "${GREEN}✅ BON: $message${NC}" ;;
    esac
}

echo "1. 🔍 Analyse des fichiers de configuration..."

# Vérifier .env et secrets
if [ -f ".env" ]; then
    show_result "CRITICAL" "Fichier .env présent - vérifiez qu'il n'est pas commité"
    if grep -q "password\|secret\|key" .env 2>/dev/null; then
        show_result "CRITICAL" "Secrets détectés dans .env"
    fi
fi

# Vérifier les mots de passe en dur
echo "2. 🔐 Recherche de mots de passe en dur..."
if grep -r "password.*=" --include="*.js" --include="*.go" . | grep -v node_modules | head -5; then
    show_result "HIGH" "Mots de passe potentiels trouvés dans le code"
else
    show_result "GOOD" "Aucun mot de passe en dur détecté"
fi

# Vérifier les tokens en dur  
echo "3. 🎫 Recherche de tokens en dur..."
if grep -r "token.*=" --include="*.js" --include="*.go" . | grep -v node_modules | head -5; then
    show_result "HIGH" "Tokens potentiels trouvés dans le code"
fi

# Vérifier les dépendances Node.js
echo "4. 📦 Audit des dépendances Node.js..."
if [ -f "web/package.json" ]; then
    cd web
    if command -v npm &> /dev/null; then
        npm audit --audit-level high 2>/dev/null | head -10
        if [ $? -eq 0 ]; then
            show_result "GOOD" "Audit npm réussi"
        else
            show_result "MEDIUM" "Vulnérabilités détectées dans les dépendances"
        fi
    fi
    cd ..
fi

# Vérifier les permissions des fichiers
echo "5. 📁 Vérification des permissions..."
find . -name "*.sql" -perm 777 2>/dev/null | head -5
if [ $? -eq 0 ]; then
    show_result "MEDIUM" "Fichiers SQL avec permissions trop larges"
fi

# Vérifier la configuration Docker
echo "6. 🐳 Analyse de la configuration Docker..."
if [ -f "docker-compose.yml" ]; then
    if grep -q "privileged.*true" docker-compose.yml; then
        show_result "HIGH" "Conteneur en mode privilégié détecté"
    fi
    
    if grep -q "network_mode.*host" docker-compose.yml; then
        show_result "MEDIUM" "Mode réseau host utilisé"
    fi
    
    show_result "GOOD" "Configuration Docker analysée"
fi

# Vérifier les en-têtes de sécurité
echo "7. 🛡️  Vérification des en-têtes de sécurité..."
if [ -f "web/server.js" ]; then
    if grep -q "helmet" web/server.js; then
        show_result "GOOD" "Helmet.js configuré"
    else
        show_result "MEDIUM" "Helmet.js non configuré - headers de sécurité manquants"
    fi
    
    if grep -q "express-rate-limit" web/server.js; then
        show_result "GOOD" "Rate limiting configuré"
    else
        show_result "HIGH" "Rate limiting manquant"
    fi
fi

# Vérifier les logs sensibles
echo "8. 📋 Recherche d'informations sensibles dans les logs..."
if grep -r "password\|token\|secret" --include="*.log" . 2>/dev/null | head -3; then
    show_result "CRITICAL" "Informations sensibles dans les logs"
fi

# Analyser les queries SQL
echo "9. 🗃️  Analyse des requêtes SQL..."
if grep -r "Query.*fmt.Sprintf\|Query.*+\|Query.*concat" api/ 2>/dev/null; then
    show_result "CRITICAL" "Requêtes SQL potentiellement vulnérables aux injections"
else
    show_result "GOOD" "Requêtes SQL utilisent des paramètres préparés"
fi

# Vérifier la validation des entrées
echo "10. ✅ Validation des entrées utilisateur..."
if grep -r "req.body\[.*\]" web/ --include="*.js" | grep -v "validate\|sanitize" | head -3; then
    show_result "MEDIUM" "Utilisation directe des entrées utilisateur sans validation"
fi

echo ""
echo "=============================================="
echo "🎯 RECOMMANDATIONS DE SÉCURITÉ"
echo "=============================================="
echo "1. 🔐 Utilisez HTTPS en production"
echo "2. 🛡️  Configurez des headers de sécurité (Helmet.js)"
echo "3. 🚦 Implémentez un rate limiting robuste"
echo "4. 🔍 Activez la surveillance et les logs"
echo "5. 🔄 Mettez à jour régulièrement les dépendances"
echo "6. 🧪 Effectuez des tests de pénétration"
echo "7. 📊 Surveillez les métriques de sécurité"
echo ""
echo "✨ Audit terminé - $(date)"