// ===== ELEMENTOS DEL DOM =====
const principalInput = document.getElementById('principal');
const annualRateInput = document.getElementById('annualRate');
const totalMonthsInput = document.getElementById('totalMonths');
const paidMonthsInput = document.getElementById('paidMonths');
const annualLimitInput = document.getElementById('annualLimit');
const frequencyMonthsSelect = document.getElementById('frequencyMonths');
const prepaymentStartMonthInput = document.getElementById('prepaymentStartMonth');
const resultsDiv = document.getElementById('results');

const btnSummary = document.getElementById('btnSummary');
const btnPrepayment = document.getElementById('btnPrepayment');
const btnCompare = document.getElementById('btnCompare');
const btnExplain = document.getElementById('btnExplain');

// ===== VARIABLES GLOBALES =====
let chartInstances = {};
let fullScheduleData = null; 
let currentInputs = null;

// ===== FUNCIONES DE FORMATEO =====
function formatUF(value) {
    const rounded = Math.round(value);
    if (rounded >= 1000) {
        return `${Math.round(rounded/1000)}k`;
    }
    return rounded.toString();
}

function formatUFComplete(value) {
    return Math.round(value).toLocaleString('es-CL');
}

// ===== FUNCIONES DE CÁLCULO FINANCIERO =====
function calculateMonthlyRate(annualRate) {
    return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

function frenchAmortization(principal, monthlyRate, totalMonths) {
    if (principal <= 0 || totalMonths <= 0) return 0;
    if (monthlyRate === 0) return principal / totalMonths;
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    return principal * (monthlyRate * factor) / (factor - 1);
}

function generateCompleteSchedule(principal, annualRate, totalMonths, prepaymentRule = () => 0) {
    const monthlyRate = calculateMonthlyRate(annualRate);
    let monthlyPayment = frenchAmortization(principal, monthlyRate, totalMonths);
    
    let balance = principal;
    let schedule = [];
    let totalInterest = 0;
    let totalPrincipalPaid = 0;
    let cumulativeInterest = 0;

    for (let month = 1; month <= totalMonths; month++) {
        if (balance <= 0.01) break;

        const interest = balance * monthlyRate;
        let capitalPayment = monthlyPayment - interest;
        
        if (balance < capitalPayment) {
            capitalPayment = balance;
            monthlyPayment = capitalPayment + interest;
        }

        const prepayment = prepaymentRule(month, balance - capitalPayment);
        const effectivePrepayment = Math.min(prepayment, balance - capitalPayment);

        balance -= capitalPayment + effectivePrepayment;
        if (balance < 0.01) balance = 0;

        totalInterest += interest;
        totalPrincipalPaid += capitalPayment + effectivePrepayment;
        cumulativeInterest += interest;

        if (effectivePrepayment > 0 && balance > 0) {
            const remainingMonths = totalMonths - month;
            if (remainingMonths > 0) {
                monthlyPayment = frenchAmortization(balance, monthlyRate, remainingMonths);
            }
        }

        schedule.push({
            'Mes': month,
            'Cuota Regular (UF)': Math.round(monthlyPayment),
            'Interés (UF)': interest.toFixed(2),
            'Amortización (UF)': Math.round(capitalPayment),
            'Prepago (UF)': Math.round(effectivePrepayment),
            'Cuota Total (UF)': Math.round(monthlyPayment + effectivePrepayment),
            'Saldo Pendiente (UF)': Math.round(balance),
            'Interés Acumulado (UF)': cumulativeInterest.toFixed(2)
        });

        if (balance <= 0) break;
    }
    
    return {
        metrics: {
            totalInterest: totalInterest,
            totalPrincipal: totalPrincipalPaid,
            finalMonths: schedule.length,
            monthlyPayment: schedule.length > 0 ? Math.round(parseFloat(schedule[schedule.length - 1]['Cuota Regular (UF)'])) : 0
        },
        schedule: schedule
    };
}

function getLoanCurrentState(principal, annualRate, totalMonths, paidMonths) {
    if (paidMonths <= 0) {
        return {
            currentBalance: principal,
            remainingMonths: totalMonths,
            monthlyPayment: frenchAmortization(principal, calculateMonthlyRate(annualRate), totalMonths),
            totalInterestPaid: 0,
            totalPrincipalPaid: 0
        };
    }

    const fullSchedule = generateCompleteSchedule(principal, annualRate, totalMonths);
    
    if (paidMonths >= fullSchedule.schedule.length) {
        return {
            currentBalance: 0,
            remainingMonths: 0,
            monthlyPayment: 0,
            totalInterestPaid: fullSchedule.metrics.totalInterest,
            totalPrincipalPaid: fullSchedule.metrics.totalPrincipal
        };
    }

    const currentRow = fullSchedule.schedule[paidMonths - 1];
    const totalInterestPaid = fullSchedule.schedule.slice(0, paidMonths)
        .reduce((sum, row) => sum + parseFloat(row['Interés (UF)']), 0);
    const totalPrincipalPaid = fullSchedule.schedule.slice(0, paidMonths)
        .reduce((sum, row) => sum + parseInt(row['Amortización (UF)']), 0);

    return {
        currentBalance: parseInt(currentRow['Saldo Pendiente (UF)']),
        remainingMonths: totalMonths - paidMonths,
        monthlyPayment: parseInt(currentRow['Cuota Regular (UF)']),
        totalInterestPaid: totalInterestPaid,
        totalPrincipalPaid: totalPrincipalPaid
    };
}

// ===== FUNCIONES DE VALIDACIÓN =====
function getInputs() {
    const principal = parseFloat(principalInput.value);
    const annualRate = parseFloat(annualRateInput.value);
    const totalMonths = parseInt(totalMonthsInput.value, 10);
    const paidMonths = parseInt(paidMonthsInput.value, 10) || 0;
    const annualLimit = parseFloat(annualLimitInput.value) || 0;
    const frequencyMonths = parseInt(frequencyMonthsSelect.value, 10);
    const prepaymentStartMonth = parseInt(prepaymentStartMonthInput.value, 10) || 0;
    
    if (isNaN(principal) || principal <= 0) return "Por favor, ingrese un monto de crédito válido (> 0).";
    if (isNaN(annualRate) || annualRate < 0) return "Por favor, ingrese una tasa anual válida (>= 0).";
    if (isNaN(totalMonths) || totalMonths <= 0) return "Por favor, ingrese un plazo en meses válido (> 0).";
    if (paidMonths < 0 || paidMonths >= totalMonths) return "Los meses pagados deben estar entre 0 y el plazo total - 1.";
    if (prepaymentStartMonth < paidMonths + 1) return `El inicio del prepago (${prepaymentStartMonth}) debe ser al menos ${paidMonths + 1} (después de los meses pagados).`;

    return { principal, annualRate, totalMonths, paidMonths, annualLimit, frequencyMonths, prepaymentStartMonth };
}

// ===== FUNCIONES DE UI =====
function displayError(message) {
    resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">${message}</p>`;
}

function displayLoading() {
    resultsDiv.innerHTML = `<div class="flex items-center justify-center space-x-2"><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse" style="animation-delay: 0.2s;"></div><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse" style="animation-delay: 0.4s;"></div><span class="text-gray-600">Calculando...</span></div>`;
}

function displayResults(htmlContent) {
    if (Object.keys(chartInstances).length > 0) {
        for (const key in chartInstances) {
            chartInstances[key].dispose();
        }
        chartInstances = {};
    }
    resultsDiv.innerHTML = htmlContent;
}

function showSuccessMessage(message) {
    const successMsg = document.createElement('div');
    successMsg.className = 'success-message fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    successMsg.textContent = `✓ ${message}`;
    document.body.appendChild(successMsg);
    setTimeout(() => document.body.removeChild(successMsg), 3000);
}

// ===== MANEJADORES DE FUNCIONALIDADES =====
function handleSummary() {
    const inputs = getInputs();
    if (typeof inputs === 'string') { displayError(inputs); return; }
    
    const { principal, annualRate, totalMonths, paidMonths } = inputs;
    currentInputs = inputs;
    displayLoading();

    setTimeout(() => {
        const currentState = getLoanCurrentState(principal, annualRate, totalMonths, paidMonths);
        const originalMonthlyPayment = frenchAmortization(principal, calculateMonthlyRate(annualRate), totalMonths);

        const htmlContent = `
            <div class="space-y-6 text-left w-full">
                <h2 class="text-xl font-semibold text-gray-800">Resumen de tu Crédito Actual</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-3">
                        <h3 class="text-lg font-medium text-blue-600">Información Original</h3>
                        <p class="text-gray-700"><strong>Monto Original (UF):</strong> ${formatUFComplete(principal)}</p>
                        <p class="text-gray-700"><strong>Cuota Original (UF):</strong> ${formatUFComplete(originalMonthlyPayment)}</p>
                        <p class="text-gray-700"><strong>Plazo Original:</strong> ${totalMonths} meses (${(totalMonths/12).toFixed(1)} años)</p>
                    </div>
                    
                    <div class="space-y-3">
                        <h3 class="text-lg font-medium text-green-600">Estado Actual</h3>
                        <p class="text-gray-700"><strong>Meses Pagados:</strong> ${paidMonths} (${(paidMonths/12).toFixed(1)} años)</p>
                        <p class="text-gray-700"><strong>Saldo Pendiente (UF):</strong> ${formatUFComplete(currentState.currentBalance)}</p>
                        <p class="text-gray-700"><strong>Meses Restantes:</strong> ${currentState.remainingMonths} (${(currentState.remainingMonths/12).toFixed(1)} años)</p>
                        <p class="text-gray-700"><strong>Cuota Actual (UF):</strong> ${formatUFComplete(currentState.monthlyPayment)}</p>
                    </div>
                </div>
                
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h3 class="text-lg font-medium text-purple-600 mb-2">Pagos Realizados</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <p class="text-gray-700"><strong>Total Intereses Pagados (UF):</strong> ${formatUFComplete(currentState.totalInterestPaid)}</p>
                        <p class="text-gray-700"><strong>Total Capital Pagado (UF):</strong> ${formatUFComplete(currentState.totalPrincipalPaid)}</p>
                    </div>
                </div>
            </div>
        `;
        displayResults(htmlContent);
    }, 500);
}

function handlePrepayment() {
    const inputs = getInputs();
    if (typeof inputs === 'string') { displayError(inputs); return; }
    
    const { principal, annualRate, totalMonths, paidMonths, annualLimit, frequencyMonths, prepaymentStartMonth } = inputs;
    currentInputs = inputs;
    displayLoading();

    setTimeout(() => {
        const currentState = getLoanCurrentState(principal, annualRate, totalMonths, paidMonths);
        const noPrepaymentFromCurrent = generateCompleteSchedule(
            currentState.currentBalance, 
            annualRate, 
            currentState.remainingMonths
        );

        const prepaymentAmount = annualLimit / (12 / frequencyMonths);
        const relativeStartMonth = Math.max(1, prepaymentStartMonth - paidMonths);
        
        const baseRule = (month) => {
            return (month >= relativeStartMonth && (month - relativeStartMonth) % frequencyMonths === 0) ? prepaymentAmount : 0;
        };
        
        const doubleRule = (month) => {
            return (month >= relativeStartMonth && (month - relativeStartMonth) % frequencyMonths === 0) ? prepaymentAmount * 2 : 0;
        };

        const baseData = generateCompleteSchedule(currentState.currentBalance, annualRate, currentState.remainingMonths, baseRule);
        const doubleData = generateCompleteSchedule(currentState.currentBalance, annualRate, currentState.remainingMonths, doubleRule);

        const scenarios = [
            { name: 'Sin Prepago', data: noPrepaymentFromCurrent, color: '#3b82f6' },
            { name: 'Límite Anual (Usuario)', data: baseData, color: '#10b981' },
            { name: 'Doble Límite', data: doubleData, color: '#8b5cf6' }
        ];

        let summaryTable = `
            <div class="w-full overflow-x-auto mb-8">
                <h3 class="text-lg font-semibold mb-4 text-center">Comparación de Estrategias de Prepago</h3>
                <table class="min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Escenario</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meses Restantes</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meses Ahorrados</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intereses Futuros (UF)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ahorro en Intereses (UF)</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
        `;

        scenarios.forEach((scenario, index) => {
            const finalMonths = scenario.data.metrics.finalMonths;
            const monthsSaved = index === 0 ? 0 : (scenarios[0].data.metrics.finalMonths - finalMonths);
            const futureInterest = scenario.data.metrics.totalInterest;
            const interestSaved = index === 0 ? 0 : (scenarios[0].data.metrics.totalInterest - futureInterest);
            
            summaryTable += `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">${scenario.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-gray-700">${finalMonths}</td>
                    <td class="px-6 py-4 whitespace-nowrap ${monthsSaved > 0 ? 'text-green-600 font-semibold' : 'text-gray-700'}">${monthsSaved}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-gray-700">${formatUFComplete(futureInterest)}</td>
                    <td class="px-6 py-4 whitespace-nowrap ${interestSaved > 0 ? 'text-green-600 font-semibold' : 'text-gray-700'}">${formatUFComplete(interestSaved)}</td>
                </tr>
            `;
        });

        summaryTable += `</tbody></table></div>`;

        const htmlContent = `
            <div class="flex flex-col w-full gap-6 text-left">
                <h2 class="text-xl font-semibold text-gray-800 text-center">Análisis de Estrategias de Prepago</h2>
                <div class="bg-blue-50 p-4 rounded-lg">
                    <p class="text-sm text-blue-800"><strong>Nota:</strong> Los cálculos se realizan desde el mes ${paidMonths + 1} con un saldo pendiente de ${formatUFComplete(currentState.currentBalance)} UF.</p>
                    <p class="text-sm text-blue-800 mt-2"><strong>Intereses ya pagados:</strong> ${formatUFComplete(currentState.totalInterestPaid)} UF | Los valores en la tabla son solo intereses futuros.</p>
                </div>
                ${summaryTable}
                <div id="prepaymentChartContainer" class="relative w-full mt-2" style="height: 550px;"></div>
            </div>`;
        displayResults(htmlContent);
        
        renderPrepaymentChart(scenarios, paidMonths);
    }, 500);
}

function handleComparison() {
    const inputs = getInputs();
    if (typeof inputs === 'string') { displayError(inputs); return; }
    
    const { principal, annualRate, totalMonths, paidMonths, annualLimit, frequencyMonths, prepaymentStartMonth } = inputs;
    currentInputs = inputs;
    displayLoading();

    setTimeout(() => {
        const noPrepaymentData = generateCompleteSchedule(principal, annualRate, totalMonths);
        
        const prepaymentAmount = annualLimit / (12 / frequencyMonths);
        const prepaymentRule = (month) => {
            return (month >= prepaymentStartMonth && (month - prepaymentStartMonth) % frequencyMonths === 0) ? prepaymentAmount : 0;
        };
        const prepaymentData = generateCompleteSchedule(principal, annualRate, totalMonths, prepaymentRule);
        
        fullScheduleData = { noPrepayment: noPrepaymentData, prepayment: prepaymentData };

        const noPrepMetrics = noPrepaymentData.metrics;
        const prepMetrics = prepaymentData.metrics;
        
        const monthsSaved = noPrepMetrics.finalMonths - prepMetrics.finalMonths;
        const yearsSaved = (monthsSaved / 12).toFixed(1);
        const interestSaved = noPrepMetrics.totalInterest - prepMetrics.totalInterest;

        const htmlContent = `
            <div class="flex flex-col w-full gap-6 text-left">
                <h2 class="text-xl font-semibold text-gray-800 text-center">Comparación de Escenarios Completos</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 w-full gap-8">
                    <div class="space-y-4 bg-blue-50 p-6 rounded-lg">
                        <h3 class="text-lg font-medium text-blue-700">Escenario Sin Prepago</h3>
                        <p class="text-gray-700"><strong>Duración total:</strong> ${noPrepMetrics.finalMonths} meses (${(noPrepMetrics.finalMonths/12).toFixed(1)} años)</p>
                        <p class="text-gray-700"><strong>Total intereses (UF):</strong> ${noPrepMetrics.totalInterest.toLocaleString('es-CL', {minimumFractionDigits: 2})}</p>
                        <p class="text-gray-700"><strong>Cuota mensual (UF):</strong> ${noPrepMetrics.monthlyPayment.toLocaleString('es-CL')}</p>
                    </div>
                    <div class="space-y-4 bg-green-50 p-6 rounded-lg">
                        <h3 class="text-lg font-medium text-green-700">Escenario Con Prepago</h3>
                        <p class="text-gray-700"><strong>Duración total:</strong> ${prepMetrics.finalMonths} meses (${(prepMetrics.finalMonths/12).toFixed(1)} años)</p>
                        <p class="text-gray-700"><strong>Total intereses (UF):</strong> ${prepMetrics.totalInterest.toLocaleString('es-CL', {minimumFractionDigits: 2})}</p>
                        <p class="text-green-600 font-bold"><strong>Tiempo ahorrado:</strong> ${monthsSaved} meses (${yearsSaved} años)</p>
                        <p class="text-green-600 font-bold"><strong>Intereses ahorrados (UF):</strong> ${interestSaved.toLocaleString('es-CL', {minimumFractionDigits: 2})}</p>
                    </div>
                </div>
                
                <div class="flex flex-wrap justify-center gap-4 border-t border-gray-300/80 pt-6">
                    <button id="btnShowBalanceChart" class="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-5 rounded-lg transition-all duration-200 shadow-md">Evolución de Saldo</button>
                    <button id="btnShowInterestChart" class="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-5 rounded-lg transition-all duration-200 shadow-md">Intereses Acumulados</button>
                    <button id="btnExportExcel" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-lg transition-all duration-200 shadow-md flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
                        Exportar a Excel
                    </button>
                </div>

                <div id="chartContainer" class="relative w-full mt-2" style="height: 550px;"></div>
            </div>
        `;
        displayResults(htmlContent);
        
        document.getElementById('btnShowBalanceChart').addEventListener('click', () => renderComparisonChart('balance'));
        document.getElementById('btnShowInterestChart').addEventListener('click', () => renderComparisonChart('interest'));
        document.getElementById('btnExportExcel').addEventListener('click', handleExportToExcel);
        
        renderComparisonChart('balance');
    }, 500);
}

function handleExplain() {
    if (!currentInputs) {
        displayError("Primero ejecuta una simulación para poder explicar los resultados.");
        return;
    }

    const explanationContent = `
        <div class="explanation-section rounded-lg p-6 space-y-6 text-left w-full">
            <h2 class="text-xl font-semibold text-gray-800 text-center">Explicación de Conceptos y Metodología</h2>
            
            <div class="space-y-6">
                <div class="bg-white p-5 rounded-lg shadow-sm border-l-4 border-blue-500">
                    <h3 class="text-lg font-medium text-blue-700 mb-3">Sistema de Amortización Francés</h3>
                    <p class="text-gray-700 mb-2">Este simulador utiliza el <strong>sistema francés</strong>, donde:</p>
                    <ul class="list-disc ml-6 text-gray-700 space-y-1">
                        <li>Las cuotas mensuales son <strong>fijas</strong> (sin considerar prepagos)</li>
                        <li>Al inicio se paga más <strong>interés</strong> y menos <strong>capital</strong></li>
                        <li>Con el tiempo, la proporción se invierte</li>
                        <li>La fórmula es: <code class="bg-gray-100 px-2 py-1 rounded">C = P × [r(1+r)^n] / [(1+r)^n - 1]</code></li>
                    </ul>
                </div>

                <div class="bg-white p-5 rounded-lg shadow-sm border-l-4 border-green-500">
                    <h3 class="text-lg font-medium text-green-700 mb-3">Cálculo de Tasa Mensual</h3>
                    <p class="text-gray-700 mb-2">La tasa nominal anual se convierte a tasa efectiva mensual:</p>
                    <p class="bg-gray-50 p-3 rounded text-sm font-mono">Tasa Mensual = (1 + Tasa_Anual/100)^(1/12) - 1</p>
                    <p class="text-gray-600 text-sm mt-2">Ejemplo: 5.4% anual = 0.4398% mensual efectivo</p>
                </div>

                <div class="bg-white p-5 rounded-lg shadow-sm border-l-4 border-purple-500">
                    <h3 class="text-lg font-medium text-purple-700 mb-3">Efecto de los Prepagos</h3>
                    <p class="text-gray-700 mb-2">Cuando realizas un prepago:</p>
                    <ol class="list-decimal ml-6 text-gray-700 space-y-1">
                        <li>Se reduce el <strong>saldo pendiente</strong></li>
                        <li>Se recalcula la <strong>cuota mensual</strong> para el período restante</li>
                        <li>Se mantiene el <strong>plazo original</strong> o se reduce el tiempo</li>
                        <li>Se generan <strong>ahorros en intereses</strong> futuros</li>
                    </ol>
                </div>

                <div class="bg-white p-5 rounded-lg shadow-sm border-l-4 border-orange-500">
                    <h3 class="text-lg font-medium text-orange-700 mb-3">Interpretación de Resultados</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <h4 class="font-semibold text-gray-800 mb-2">Métricas Clave:</h4>
                            <ul class="space-y-1 text-gray-700">
                                <li><strong>Saldo Pendiente:</strong> Capital por pagar</li>
                                <li><strong>Cuota Regular:</strong> Pago mensual fijo</li>
                                <li><strong>Interés:</strong> Costo del financiamiento</li>
                                <li><strong>Amortización:</strong> Pago de capital</li>
                            </ul>
                        </div>
                        <div>
                            <h4 class="font-semibold text-gray-800 mb-2">Beneficios del Prepago:</h4>
                            <ul class="space-y-1 text-gray-700">
                                <li><strong>Reducción del plazo</strong></li>
                                <li><strong>Ahorro en intereses</strong></li>
                                <li><strong>Mayor equidad patrimonial</strong></li>
                                <li><strong>Menor riesgo financiero</strong></li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-5 rounded-lg shadow-sm border-l-4 border-red-500">
                    <h3 class="text-lg font-medium text-red-700 mb-3">Consideraciones Importantes</h3>
                    <ul class="list-disc ml-6 text-gray-700 space-y-1">
                        <li>Los cálculos son <strong>referenciales</strong> y pueden diferir de la realidad</li>
                        <li>No considera <strong>seguros, comisiones o gastos</strong> adicionales</li>
                        <li>Las <strong>tasas pueden variar</strong> en el tiempo (si es variable)</li>
                        <li>Evalúa la <strong>oportunidad de inversión</strong> vs. prepago</li>
                        <li>Considera tu <strong>liquidez</strong> antes de hacer prepagos grandes</li>
                    </ul>
                </div>

                <div class="bg-gradient-to-r from-blue-50 to-green-50 p-5 rounded-lg border">
                    <h3 class="text-lg font-medium text-gray-800 mb-3">Recomendaciones</h3>
                    <div class="text-sm text-gray-700 space-y-2">
                        <p><strong>Estrategia Gradual:</strong> Comienza con prepagos pequeños y aumenta gradualmente</p>
                        <p><strong>Timing Óptimo:</strong> Los prepagos son más efectivos al inicio del crédito</p>
                        <p><strong>Frecuencia:</strong> Prepagos más frecuentes generan mayores ahorros</p>
                        <p><strong>Balance:</strong> Mantén un fondo de emergencia antes de hacer prepagos grandes</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    displayResults(explanationContent);
}

function handleExportToExcel() {
    if (!fullScheduleData) { 
        alert("Primero debes ejecutar la comparación de escenarios para generar los datos."); 
        return; 
    }
    
    try {
        const wsNoPrepayment = XLSX.utils.json_to_sheet(fullScheduleData.noPrepayment.schedule);
        const wsPrepayment = XLSX.utils.json_to_sheet(fullScheduleData.prepayment.schedule);
        
        const summaryData = [
            { Concepto: "Escenario", "Sin Prepago": "Base", "Con Prepago": "Con Prepagos" },
            { Concepto: "Duración (meses)", "Sin Prepago": fullScheduleData.noPrepayment.metrics.finalMonths, "Con Prepago": fullScheduleData.prepayment.metrics.finalMonths },
            { Concepto: "Total Intereses (UF)", "Sin Prepago": fullScheduleData.noPrepayment.metrics.totalInterest.toFixed(2), "Con Prepago": fullScheduleData.prepayment.metrics.totalInterest.toFixed(2) },
            { Concepto: "Meses Ahorrados", "Sin Prepago": 0, "Con Prepago": fullScheduleData.noPrepayment.metrics.finalMonths - fullScheduleData.prepayment.metrics.finalMonths },
            { Concepto: "Intereses Ahorrados (UF)", "Sin Prepago": 0, "Con Prepago": (fullScheduleData.noPrepayment.metrics.totalInterest - fullScheduleData.prepayment.metrics.totalInterest).toFixed(2) }
        ];
        const wsResumen = XLSX.utils.json_to_sheet(summaryData);
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
        XLSX.utils.book_append_sheet(wb, wsNoPrepayment, "Sin Prepago");
        XLSX.utils.book_append_sheet(wb, wsPrepayment, "Con Prepago");
        
        XLSX.writeFile(wb, `Simulacion_Credito_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showSuccessMessage('Archivo Excel exportado exitosamente');
        
    } catch (error) {
        console.error("Error al exportar a Excel:", error);
        alert("Ocurrió un error al generar el archivo Excel. Revisa la consola para más detalles.");
    }
}

// ===== FUNCIONES DE RENDERIZADO DE GRÁFICOS =====
function renderComparisonChart(type) {
    const chartContainer = document.getElementById('chartContainer');
    if (!chartContainer || !fullScheduleData || !currentInputs) return;

    if (Object.keys(chartInstances).length > 0) {
        for (const key in chartInstances) {
            chartInstances[key].dispose();
        }
        chartInstances = {};
    }
    
    const { paidMonths, totalMonths, prepaymentStartMonth } = currentInputs;

    if (type === 'balance') {
        chartContainer.innerHTML = ''; 
        chartContainer.style.height = '550px'; 
        
        chartInstances['balance'] = echarts.init(chartContainer);

        const noPrepSchedule = fullScheduleData.noPrepayment.schedule;
        const prepSchedule = fullScheduleData.prepayment.schedule;
        const noPrepChartData = noPrepSchedule.map(d => parseFloat(d['Saldo Pendiente (UF)']));
        const prepChartData = prepSchedule.map(d => parseFloat(d['Saldo Pendiente (UF)']));
        const noPrepPadded = [...noPrepChartData]; 
        while (noPrepPadded.length < totalMonths) noPrepPadded.push(null);
        const prepPadded = [...prepChartData]; 
        while (prepPadded.length < totalMonths) prepPadded.push(null);
        
        const option = {
            backgroundColor: 'transparent',
            title: { text: 'Evolución del Saldo del Crédito', left: 'center' },
            tooltip: { trigger: 'axis' },
            legend: { data: ['Sin Prepago', 'Con Prepago'], bottom: 15 },
            grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { 
                type: 'category', 
                boundaryGap: false, 
                data: Array.from({ length: totalMonths }, (_, i) => i + 1)
            },
            yAxis: { 
                type: 'value', 
                name: 'Saldo Pendiente (UF)', 
                axisLabel: { formatter: (v) => `${formatUF(v)} UF` } 
            },
            series: [
                { 
                    name: 'Sin Prepago', 
                    type: 'line', 
                    smooth: true, 
                    data: noPrepPadded, 
                    lineStyle: { color: '#3b82f6' }, 
                    areaStyle: { opacity: 0.08 } 
                },
                { 
                    name: 'Con Prepago', 
                    type: 'line', 
                    smooth: true, 
                    data: prepPadded, 
                    lineStyle: { color: '#10b981' }, 
                    areaStyle: { opacity: 0.08 } 
                }
            ]
        };
        chartInstances['balance'].setOption(option);

    } else { 
        chartContainer.removeAttribute('style');
        chartContainer.innerHTML = `
            <div id="yearlySavingsChart" style="width: 100%; height: 350px; margin-bottom: 40px;"></div>
            <div id="totalSummaryChart" style="width: 100%; height: 300px;"></div>
        `;

        chartInstances['yearlySavings'] = echarts.init(document.getElementById('yearlySavingsChart'));
        chartInstances['totalSummary'] = echarts.init(document.getElementById('totalSummaryChart'));

        const noPrepSchedule = fullScheduleData.noPrepayment.schedule;
        const prepSchedule = fullScheduleData.prepayment.schedule;
        const noPrepMetrics = fullScheduleData.noPrepayment.metrics;
        const prepMetrics = fullScheduleData.prepayment.metrics;
        
        // CORRECCIÓN CRÍTICA: Mostrar TODOS los años, marcando inicio de prepagos
        const creditStartDate = new Date();
        creditStartDate.setMonth(creditStartDate.getMonth() - paidMonths);
        const prepaymentStartDate = new Date(creditStartDate);
        prepaymentStartDate.setMonth(prepaymentStartDate.getMonth() + prepaymentStartMonth - 1);
        const prepaymentStartYear = prepaymentStartDate.getFullYear();

        const allYearlyData = {};
        const fullDateLabels = Array.from({ length: noPrepSchedule.length }, (_, i) => {
            const monthDate = new Date(creditStartDate);
            monthDate.setMonth(creditStartDate.getMonth() + i);
            return { year: monthDate.getFullYear() };
        });

        noPrepSchedule.forEach((noPrepRow, i) => {
            const year = fullDateLabels[i].year;
            if (!allYearlyData[year]) { 
                allYearlyData[year] = { 
                    paid: 0, 
                    saved: 0,
                    isPrepagoActive: year >= prepaymentStartYear 
                }; 
            }
            
            const noPrepInterest = parseFloat(noPrepRow['Interés (UF)']);
            let prepInterest = (i < prepSchedule.length) ? parseFloat(prepSchedule[i]['Interés (UF)']) : 0;
            const monthlySaving = noPrepInterest - prepInterest;

            allYearlyData[year].paid += prepInterest;
            allYearlyData[year].saved += monthlySaving;
        });

        // MEJORA: No filtrar, mostrar todos los años
        const years = Object.keys(allYearlyData);
        const finalYearlyPayments = years.map(year => allYearlyData[year].paid);
        const finalYearlySavings = years.map(year => allYearlyData[year].saved);
        const isPrepaymentActive = years.map(year => allYearlyData[year].isPrepagoActive);

        const yearlySavingsOption = {
            backgroundColor: 'transparent',
            title: { 
                text: 'Desglose de Intereses por Año', 
                left: 'center', 
                textStyle: { fontSize: 18, fontWeight: 'bold' },
                subtext: `Línea vertical indica inicio de prepagos (${prepaymentStartYear})`,
                subtextStyle: { fontSize: 12, color: '#718096' }
            },
            tooltip: { 
                trigger: 'axis', 
                axisPointer: { type: 'shadow' },
                formatter: function(params) {
                    const yearIndex = params[0].dataIndex;
                    const year = years[yearIndex];
                    const isActive = isPrepaymentActive[yearIndex];
                    let result = `<div style="font-weight: bold; margin-bottom: 8px;">${year}</div>`;
                    if (isActive) {
                        result += `<div style="color: #10b981; font-size: 11px; margin-bottom: 6px;">Con Prepagos Activos</div>`;
                    } else {
                        result += `<div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">Antes de Prepagos</div>`;
                    }
                    params.forEach(param => {
                        result += `<div style="margin: 4px 0;">${param.marker} ${param.seriesName}: <strong>${formatUF(param.value)} UF</strong></div>`;
                    });
                    return result;
                }
            },
            legend: { data: ['Intereses Pagados', 'Ahorro Anual'], top: 60 },
            grid: { top: 90, left: '3%', right: '4%', bottom: '10%', containLabel: true },
            xAxis: { 
                type: 'category', 
                data: years,
                axisLabel: {
                    formatter: function(value, index) {
                        return isPrepaymentActive[index] ? `{active|${value}}` : value;
                    },
                    rich: {
                        active: {
                            color: '#10b981',
                            fontWeight: 'bold'
                        }
                    }
                }
            },
            yAxis: { type: 'value', name: 'Monto (UF)', axisLabel: { formatter: (v) => formatUF(v) } },
            series: [
                {
                    name: 'Intereses Pagados',
                    type: 'bar',
                    itemStyle: { 
                        color: function(params) {
                            return isPrepaymentActive[params.dataIndex] ? '#3b82f6' : '#94a3b8';
                        }
                    },
                    label: { show: true, position: 'top', formatter: (p) => p.value > 0 ? formatUF(p.value) : '' },
                    data: finalYearlyPayments.map(val => Math.round(val)),
                    markLine: {
                        silent: true,
                        lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
                        data: [{
                            xAxis: years.indexOf(prepaymentStartYear.toString()),
                            label: { 
                                show: true, 
                                position: 'insideEndTop', 
                                formatter: 'Inicio Prepagos',
                                color: '#d97706',
                                fontWeight: 'bold'
                            }
                        }]
                    }
                },
                {
                    name: 'Ahorro Anual',
                    type: 'bar',
                    itemStyle: { 
                        color: function(params) {
                            return isPrepaymentActive[params.dataIndex] ? '#10b981' : '#d1fae5';
                        }
                    },
                    label: { show: true, position: 'top', formatter: (p) => p.value > 0 ? formatUF(p.value) : '' },
                    data: finalYearlySavings.map(val => Math.round(val))
                }
            ]
        };
        chartInstances['yearlySavings'].setOption(yearlySavingsOption);
        
        const interestOriginalTotal = noPrepMetrics.totalInterest;
        const interestWithPrepTotal = prepMetrics.totalInterest;
        const interestSavedTotal = interestOriginalTotal - interestWithPrepTotal;

        const totalSummaryOption = {
            backgroundColor: 'transparent',
            title: { 
                text: 'Comparación Final de Intereses', 
                left: 'center', 
                textStyle: { fontSize: 18, fontWeight: 'bold' } 
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params) {
                    let html = `<b>Resumen General de Intereses</b><hr style="margin: 8px 0;"/>`;
                    html += `Total Sin Prepago: <strong>${formatUFComplete(interestOriginalTotal)} UF</strong><br/>`;
                    html += `Total Con Prepago: <strong>${formatUFComplete(interestWithPrepTotal)} UF</strong><br/><br/>`;
                    html += `<span style="color: #10b981">●</span> Ahorro Total: ${formatUFComplete(interestSavedTotal)} UF`;
                    return html;
                }
            },
            legend: { data: ['Total Sin Prepago', 'Total Con Prepago', 'Ahorro Total'], top: 30 },
            grid: { top: 70, left: '3%', right: '4%', bottom: '10%', containLabel: true },
            xAxis: { type: 'category', data: ['Comparativo Final'] },
            yAxis: { type: 'value', name: 'Monto (UF)', axisLabel: { formatter: (v) => formatUF(v) } },
            series: [
                { name: 'Total Sin Prepago', type: 'bar', itemStyle: { color: '#8b5cf6' }, label: { show: true, position: 'top', formatter: (p) => `${formatUF(p.value)} UF` }, data: [Math.round(interestOriginalTotal)] },
                { name: 'Total Con Prepago', type: 'bar', itemStyle: { color: '#3b82f6' }, label: { show: true, position: 'top', formatter: (p) => `${formatUF(p.value)} UF` }, data: [Math.round(interestWithPrepTotal)] },
                { name: 'Ahorro Total', type: 'bar', itemStyle: { color: '#10b981' }, label: { show: true, position: 'top', formatter: (p) => `${formatUF(p.value)} UF` }, data: [Math.round(interestSavedTotal)] }
            ]
        };
        chartInstances['totalSummary'].setOption(totalSummaryOption);
    }
}

function renderPrepaymentChart(scenarios, offsetMonths = 0) {
    const chartContainer = document.getElementById('prepaymentChartContainer');
    if (!chartContainer || !currentInputs) return;

    chartInstances['prepayment'] = echarts.init(chartContainer);

    const { paidMonths, prepaymentStartMonth } = currentInputs;
    const maxLength = Math.max(...scenarios.map(s => s.data.schedule.length));
    
    const currentDate = new Date();
    const startDate = new Date(currentDate);
    startDate.setMonth(currentDate.getMonth() - paidMonths);
    
    const createMarkPoint = (schedule, seriesColor, scenarioName) => {
        const finalRelativeMonth = schedule.length;
        if (finalRelativeMonth === 0) return {};
        const actualFinalMonth = paidMonths + finalRelativeMonth;
        const finalDate = new Date(startDate);
        finalDate.setMonth(startDate.getMonth() + actualFinalMonth);
        const finalYear = finalDate.getFullYear();
        const finalMonthName = finalDate.toLocaleDateString('es-ES', { month: 'short' });
        
        return {
            name: `Fin ${scenarioName}`,
            coord: [finalRelativeMonth - 1, 0],
            value: `${finalMonthName} ${finalYear}`,
            symbol: 'circle',
            symbolSize: 14,
            itemStyle: {
                color: seriesColor,
                borderColor: '#ffffff',
                borderWidth: 2,
                shadowColor: 'rgba(0, 0, 0, 0.2)',
                shadowBlur: 8
            },
            label: {
                show: true,
                position: 'top',
                formatter: '{c}',
                color: '#2d3748',
                fontWeight: 'bold',
                fontSize: 10,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: seriesColor,
                borderWidth: 1.0,
                borderRadius: 5,
                padding: [4, 8],
                shadowColor: 'rgba(0, 0, 0, 0.1)',
                shadowBlur: 4
            }
        };
    };

    const relativePrepaymentStart = prepaymentStartMonth - paidMonths;
    const prepaymentDate = new Date(startDate);
    prepaymentDate.setMonth(startDate.getMonth() + prepaymentStartMonth);
    const prepaymentDateStr = prepaymentDate.toLocaleDateString('es-ES', { 
        month: 'short', 
        year: 'numeric' 
    });

    const prepaymentStartLine = relativePrepaymentStart > 0 ? {
        type: 'line',
        name: `Inicio Prepagos`,
        markLine: {
            silent: true,
            symbol: ['none', 'none'],
            data: [{
                xAxis: relativePrepaymentStart,
                lineStyle: { 
                    color: '#ff6b35', 
                    width: 2, 
                    type: 'dashed',
                    shadowColor: 'rgba(255, 107, 53, 0.3)',
                    shadowBlur: 5
                },
                label: {  
                    show: true, 
                    position: 'insideMiddleTop',
                    formatter: `Inicio Prepago`,
                    color: '#c53030',
                    fontWeight: 'bold',
                    fontSize: 11,
                }
            }]
        },
        data: []
    } : null;

    const dateLabels = Array.from({ length: maxLength }, (_, i) => {
        const monthDate = new Date(currentDate);
        monthDate.setMonth(currentDate.getMonth() + i + 1);
        return {
            month: monthDate.getMonth() + 1,
            year: monthDate.getFullYear(),
            shortMonth: monthDate.toLocaleDateString('es-ES', { month: 'short' }),
            fullDate: monthDate,
            realMonth: paidMonths + i + 1
        };
    });

    const option = {
        title: { 
            text: 'SIMULACIÓN PREPAGO DEL CRÉDITO HIPOTECARIO', 
            left: 'center', 
            textStyle: { 
                fontSize: 18, 
                fontWeight: 'bold',
                color: '#2d3748'
            },
            subtext: `Simulación desde ${currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })} • ${paidMonths} meses pagados`,
            subtextStyle: { 
                fontSize: 13, 
                color: '#718096',
                fontStyle: 'italic'
            }
        },
        tooltip: { 
            trigger: 'axis',
            axisPointer: {
                type: 'cross',
                lineStyle: { 
                    color: '#cbd5e0', 
                    type: 'solid',
                    width: 1
                },
                crossStyle: {
                    color: '#a0aec0'
                }
            },
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            textStyle: {
                color: '#2d3748',
                fontSize: 11
            },
            formatter: function(params) {
                const relativeMonth = parseInt(params[0].axisValue);
                const dateInfo = dateLabels[relativeMonth - 1];
                if (!dateInfo) return '';
                
                const isPrepaymentsActive = dateInfo.realMonth >= prepaymentStartMonth;
                
                let result = `<div style="font-weight: bold; margin-bottom: 8px; color: #2d3748;">
                    ${dateInfo.shortMonth} ${dateInfo.year} (Mes ${dateInfo.realMonth})
                </div>`;
                
                if (isPrepaymentsActive) {
                    result += `<div style="color: #ff6b35; font-size: 11px; margin-bottom: 6px; background: #fff5f0; padding: 2px 6px; border-radius: 4px;">
                        Simulación de Prepagos
                    </div>`;
                } else {
                    const monthsUntil = prepaymentStartMonth - dateInfo.realMonth;
                    result += `<div style="color: #718096; font-size: 11px; margin-bottom: 6px; background: #f7fafc; padding: 2px 6px; border-radius: 4px;">
                        Prepagos en ${monthsUntil} meses
                    </div>`;
                }
                
                params.forEach(param => {
                    if (param.value !== null && param.value !== undefined && param.seriesType === 'line') {
                        const value = parseFloat(param.value);
                        const formattedValue = value >= 1000 ? 
                            `${Math.round(value/1000)}k` : 
                            Math.round(value);
                        result += `<div style="color: ${param.color}; margin: 4px 0; display: flex; align-items: center;">
                            <span style="display: inline-block; width: 8px; height: 8px; background: ${param.color}; border-radius: 50%; margin-right: 8px;"></span>
                            <strong>${param.seriesName}:</strong>&nbsp;${formattedValue} UF
                        </div>`;
                    }
                });
                return result;
            }
        },
        legend: { 
            data: scenarios.map(s => s.name), 
            bottom: 15,
            textStyle: { 
                fontSize: 13,
                color: '#4a5568'
            },
            itemGap: 25,
            icon: 'roundRect',
            itemWidth: 16,
            itemHeight: 3
        },
        grid: { 
            left: '4%', 
            right: '4%', 
            bottom: '20%', 
            top: '15%', 
            containLabel: true 
        },
        xAxis: { 
            type: 'category', 
            boundaryGap: false, 
            data: dateLabels.map((_, i) => i + 1),
            name: 'Años del Crédito',
            nameLocation: 'middle',
            nameGap: 35,
            nameTextStyle: { 
                fontSize: 14, 
                color: '#4a5568',
                fontWeight: '500'
            },
            axisLabel: {
                interval: function(index, value) {
                    const dateInfo = dateLabels[index];
                    if (!dateInfo) return false;
                    return dateInfo.month === 1;
                },
                formatter: function(value) {
                    const dateInfo = dateLabels[parseInt(value) - 1];
                    if (!dateInfo) return '';
                    return dateInfo.year;
                },
                fontSize: 11,
                color: '#718096',
                margin: 8
            },
            axisTick: {
                alignWithLabel: false,
                interval: function(index, value) {
                    const dateInfo = dateLabels[index];
                    return dateInfo && dateInfo.month === 1;
                },
                lineStyle: { color: '#cbd5e0' }
            },
            axisLine: {
                lineStyle: { color: '#e2e8f0', width: 1 }
            },
            splitLine: {
                show: true,
                interval: function(index, value) {
                    const dateInfo = dateLabels[index];
                    return dateInfo && dateInfo.month === 1;
                },
                lineStyle: { 
                    color: '#f1f5f9', 
                    type: 'solid',
                    width: 1
                }
            }
        },
        yAxis: { 
            type: 'value', 
            name: 'Saldo Pendiente (UF)',
            nameLocation: 'middle',
            nameGap: 80,
            nameTextStyle: { 
                fontSize: 12, 
                color: '#4a5568',
                fontWeight: '500'
            },
            axisLabel: {
                formatter: (value) => {
                    if (value >= 1000) return `${Math.round(value/1000)}k`;
                    if (value >= 100) return Math.round(value);
                    return Math.round(value);
                },
                fontSize: 11,
                color: '#718096'
            },
            axisLine: {
                lineStyle: { color: '#e2e8f0', width: 2 }
            },
            axisTick: {
                lineStyle: { color: '#cbd5e0' }
            },
            splitLine: {
                lineStyle: { 
                    color: '#f8fafc',
                    type: 'solid',
                    width: 1
                }
            }
        },
        series: [
            ...(prepaymentStartLine ? [prepaymentStartLine] : []),
            ...scenarios.map((scenario, index) => {
                const data = scenario.data.schedule.map(d => parseFloat(d['Saldo Pendiente (UF)']));
                const paddedData = [...data];
                while (paddedData.length < maxLength) paddedData.push(null);
                
                return {
                    name: scenario.name, 
                    type: 'line', 
                    smooth: true, 
                    data: paddedData,
                    lineStyle: { 
                        width: 2,
                        shadowColor: `${scenario.color}30`,
                        shadowBlur: 4
                    },
                    itemStyle: { 
                        color: scenario.color,
                        borderWidth: 1,
                        borderColor: '#ffffff'
                    },
                    areaStyle: {
                        opacity: 0.08,
                        color: scenario.color
                    },
                    markPoint: { 
                        data: [createMarkPoint(scenario.data.schedule, scenario.color, scenario.name)],
                        animation: true,
                        animationDuration: 1000,
                        animationEasing: 'bounceOut'
                    },
                    z: 15 + index,
                    emphasis: {
                        focus: 'series',
                        lineStyle: {
                            width: 2
                        }
                    }
                };
            })
        ]
    };
    chartInstances['prepayment'].setOption(option);
}

// ===== EVENT LISTENERS =====
btnSummary.addEventListener('click', handleSummary);
btnPrepayment.addEventListener('click', handlePrepayment);
btnCompare.addEventListener('click', handleComparison);
btnExplain.addEventListener('click', handleExplain);

window.addEventListener('resize', () => {
    if (Object.keys(chartInstances).length > 0) {
        setTimeout(() => {
            for (const key in chartInstances) {
                chartInstances[key].resize();
            }
        }, 300);
    }
});