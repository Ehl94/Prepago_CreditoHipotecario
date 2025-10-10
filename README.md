# 🏠 Simulador de Crédito Hipotecario - Prepago

Una aplicación web interactiva para simular y analizar diferentes estrategias de prepago en créditos hipotecarios.

## 🚀 Características Principales

### 📊 Análisis Completo
- **Resumen del Crédito**: Visualiza el estado actual de tu crédito hipotecario
- **Simulación de Prepagos**: Calcula el impacto de diferentes estrategias de prepago
- **Comparación de Escenarios**: Compara el crédito con y sin prepagos
- **Explicación Detallada**: Entiende la metodología y conceptos financieros

### 🧮 Cálculos Precisos
- Sistema de amortización francés
- Tasa de interés efectiva mensual
- Recálculo dinámico tras prepagos
- Límites de prepago configurables

### 📈 Visualizaciones Interactivas
- Gráficos de evolución del saldo
- Análisis de intereses acumulados
- Cronogramas detallados por año
- Comparación visual de escenarios

### 📄 Exportación de Datos
- Exportación a Excel completa
- Cronogramas detallados
- Resúmenes comparativos

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Estilo**: Tailwind CSS con efectos glassmorphism
- **Gráficos**: ECharts para visualizaciones interactivas
- **Exportación**: SheetJS para generar archivos Excel
- **Diseño**: Responsive design con CSS Grid y Flexbox

## 🎯 Funcionalidades

### 1. Configuración del Crédito
- Monto del crédito (UF)
- Tasa nominal anual (%)
- Plazo en meses
- Meses ya pagados

### 2. Estrategia de Prepagos
- Límite de prepago anual (UF)
- Frecuencia (semestral o anual)
- Mes de inicio de prepagos
- Simulación automática de diferentes montos

### 3. Análisis y Reportes
- Ahorro en intereses
- Reducción del plazo
- Comparación de escenarios
- Recomendaciones personalizadas

## 🚀 Uso

1. **Abrir la aplicación**: Abre `index.html` en tu navegador web
2. **Configurar parámetros**: Ingresa los datos de tu crédito hipotecario
3. **Ejecutar simulaciones**: Usa los botones para diferentes análisis:
   - "Resumen de mi Crédito": Estado actual del crédito
   - "Plan de Prepago": Estrategias de prepago optimizadas
   - "Comparar Escenarios": Análisis completo con gráficos
   - "Explicar Resultados": Metodología y conceptos

## 📊 Metodología

### Sistema de Amortización Francés
Utiliza la fórmula estándar para cuotas fijas:

```
C = P × [r(1+r)^n] / [(1+r)^n - 1]
```

Donde:
- `C` = Cuota mensual
- `P` = Principal (monto del crédito)
- `r` = Tasa mensual efectiva
- `n` = Número total de cuotas

### Conversión de Tasas
Convierte la tasa nominal anual a efectiva mensual:

```
r_mensual = (1 + r_anual/100)^(1/12) - 1
```

## ⚠️ Consideraciones Importantes

- Los cálculos son **referenciales** y pueden diferir de condiciones reales
- No considera seguros, comisiones o gastos adicionales
- Las tasas pueden variar en el tiempo (si es variable)
- Evalúa la oportunidad de inversión vs. prepago
- Mantén liquidez antes de hacer prepagos grandes

## 🎨 Diseño

La aplicación utiliza un diseño moderno con:
- Efectos de glassmorphism
- Gradientes suaves
- Animaciones CSS
- Diseño completamente responsive
- Accesibilidad mejorada

## 📱 Compatibilidad

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 13+
- ✅ Edge 80+
- ✅ Dispositivos móviles

## 📝 Estructura de Archivos

```
├── index.html          # Página principal
├── script.js           # Lógica de cálculos y simulaciones
├── style.css.css       # Estilos personalizados
├── mortgage_investment_analyzer.tsx  # Componente adicional
└── README.md           # Esta documentación
```

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu funcionalidad (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📧 Contacto

**Emilio Huerta** - [GitHub](https://github.com/EmilioHuerta)

---

⭐ ¡Si te parece útil este proyecto, dale una estrella en GitHub!