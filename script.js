// --- Obtener referencias a los elementos del DOM ---
const principalInput = document.getElementById('principal');
const annualRateInput = document.getElementById('annualRate');
const totalMonthsInput = document.getElementById('totalMonths');
const paidMonthsInput = document.getElementById('paidMonths');
const annualLimitInput = document.getElementById('annualLimit');
const frequencyMonthsSelect = document.getElementById('frequencyMonths');
const prepaymentStartMonthInput = document.getElementById('prepaymentStartMonth');
const startDateInput = document.getElementById('startDate');
const resultsDiv = document.getElementById('results');

const btnSummary = document.getElementById('btnSummary');
const btnPrepayment = document.getElementById('btnPrepayment');
const btnCompare = document.getElementById('btnCompare');
const btnExplain = document.getElementById('btnExplain');

// --- Variables Globales ---
let echartInstance = null;
let fullScheduleData = null; // Almacenará los datos para el botón "Explicar"

// --- Inicialización ---
const today = new Date();
const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
startDateInput.value = fiveYearsAgo.toISOString().split('T')[0];

// --- Funciones de Cálculo Financiero ---
function calculateMonthlyRate(annualRate) {
    return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

function frenchAmortization(principal, monthlyRate, totalMonths) {
    if (principal <= 0 || totalMonths <= 0) return 0;
    if (monthlyRate === 0) return principal / totalMonths;
    const factor = Math.pow(1 + monthlyRate, totalMonths);
    return principal * (monthlyRate * factor) / (factor - 1);
}

function generateSchedule(principal, annualRate, totalMonths, prepaymentRule = (month, balance) => 0) {
    const monthlyRate = calculateMonthlyRate(annualRate);
    let monthlyPayment = frenchAmortization(principal, monthlyRate, totalMonths);
    
    let balance = principal;
    let schedule = [];
    let totalInterest = 0;
    let totalPrincipalPaid = 0;

    for (let month = 1; month <= totalMonths; month++) {
        if (balance < 0.01) break;

        const prepayment = prepaymentRule(month, balance);

        if (prepayment > 0 && balance > prepayment) {
            balance -= prepayment;
            totalPrincipalPaid += prepayment;
            monthlyPayment = frenchAmortization(balance, monthlyRate, totalMonths - month + 1);
        }

        const interest = balance * monthlyRate;
        let capitalPayment = monthlyPayment - interest;
        
        if (balance < capitalPayment) {
            capitalPayment = balance;
        }
        
        balance -= capitalPayment;
        totalInterest += interest;
        totalPrincipalPaid += capitalPayment;
        
        if (balance < 0.01) balance = 0;

        schedule.push({
            'Mes': month,
            'Cuota (UF)': (monthlyPayment + (prepayment > 0 ? prepayment : 0)).toFixed(4),
            'Interés (UF)': interest.toFixed(4),
            'Amortización (UF)': capitalPayment.toFixed(4),
            'Prepago (UF)': prepayment.toFixed(4),
            'Saldo Pendiente (UF)': balance.toFixed(4)
        });
    }
    
    return {
        metrics: {
            totalInterest: totalInterest,
            totalPrincipal: totalPrincipalPaid,
            finalMonths: schedule.length
        },
        schedule: schedule
    };
}

// --- Funciones de Interfaz de Usuario (UI) ---
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
    if (paidMonths < 0 || paidMonths >= totalMonths) return "Los meses pagados deben ser menores al plazo total.";
    if (prepaymentStartMonth <= paidMonths) return `El inicio del prepago (${prepaymentStartMonth}) debe ser posterior a los meses ya pagados (${paidMonths}).`;

    return { principal, annualRate, totalMonths, paidMonths, annualLimit, frequencyMonths, prepaymentStartMonth };
}

function displayError(message) {
    resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">${message}</p>`;
}

function displayLoading() {
    resultsDiv.innerHTML = `<div class="flex items-center justify-center space-x-2"><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse" style="animation-delay: 0.2s;"></div><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse" style="animation-delay: 0.4s;"></div><span class="text-gray-600">Calculando...</span></div>`;
}

function displayResults(htmlContent) {
    resultsDiv.innerHTML = htmlContent;
    if (echartInstance) {
        echartInstance.dispose();
        echartInstance = null;
    }
}

// --- Manejadores de Lógica Principal ---
function getLoanStateToday(principal, annualRate, totalMonths, paidMonths) {
    const fullSchedule = generateSchedule(principal, annualRate, totalMonths).schedule;
    const startingBalance = paidMonths > 0 && paidMonths < fullSchedule.length ? parseFloat(fullSchedule[paidMonths - 1]['Saldo Pendiente (UF)']) : principal;
    const remainingMonths = totalMonths - paidMonths;
    return { startingBalance, remainingMonths };
}

function handleSummary() {
    const inputs = getInputs();
    if (typeof inputs === 'string') { displayError(inputs); return; }
    const { principal, annualRate, totalMonths, paidMonths } = inputs;
    displayLoading();

    setTimeout(() => {
        const { startingBalance, remainingMonths } = getLoanStateToday(principal, annualRate, totalMonths, paidMonths);
        const monthlyPayment = frenchAmortization(principal, calculateMonthlyRate(annualRate), totalMonths);

        const htmlContent = `<div class="space-y-4 text-left w-full"><h2 class="text-xl font-semibold text-gray-800">Resumen de tu Crédito Actual</h2><p class="text-gray-700"><strong>Monto Original (UF):</strong> ${principal.toFixed(2)}</p><p class="text-gray-700"><strong>Cuota mensual (UF):</strong> ${monthlyPayment.toFixed(4)}</p><p class="text-gray-700"><strong>Saldo pendiente (UF):</strong> ${startingBalance.toFixed(2)}</p><p class="text-gray-700"><strong>Meses restantes:</strong> ${remainingMonths} (${(remainingMonths / 12).toFixed(1)} años)</p></div>`;
        displayResults(htmlContent);
    }, 500);
}

function handlePrepayment() {
    const inputs = getInputs();
    if (typeof inputs === 'string') { displayError(inputs); return; }
    const { principal, annualRate, totalMonths, annualLimit, frequencyMonths, prepaymentStartMonth } = inputs;
    displayLoading();

    setTimeout(() => {
        const fullNoPrepaymentData = generateSchedule(principal, annualRate, totalMonths);

        const prepaymentAmountBase = annualLimit / (12 / frequencyMonths);
        const baseRule = (month, balance) => (month >= prepaymentStartMonth && (month - prepaymentStartMonth) % frequencyMonths === 0) ? prepaymentAmountBase : 0;
        const baseData = generateSchedule(principal, annualRate, totalMonths, baseRule);

        const prepaymentAmountDouble = (annualLimit * 2) / (12 / frequencyMonths);
        const doubleRule = (month, balance) => (month >= prepaymentStartMonth && (month - prepaymentStartMonth) % frequencyMonths === 0) ? prepaymentAmountDouble : 0;
        const doubleData = generateSchedule(principal, annualRate, totalMonths, doubleRule);

        const scenarios = [
            { name: 'Sin Prepago', data: fullNoPrepaymentData },
            { name: 'Límite Anual (Usuario)', data: baseData },
            { name: 'Doble Límite', data: doubleData }
        ];

        let summaryTable = `<div class="w-full overflow-x-auto mb-8"><h3 class="text-lg font-semibold mb-4 text-center">Resumen de Escenarios</h3><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Escenario</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plazo Final (Años)</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Años Ahorrados</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Intereses Ahorrados (UF)</th></tr></thead><tbody class="bg-white divide-y divide-gray-200">`;

        scenarios.forEach(scenario => {
            const finalYears = (scenario.data.metrics.finalMonths / 12).toFixed(1);
            const yearsSaved = ((totalMonths - scenario.data.metrics.finalMonths) / 12).toFixed(1);
            const interestSaved = (fullNoPrepaymentData.metrics.totalInterest - scenario.data.metrics.totalInterest).toFixed(2);
            summaryTable += `<tr><td class="px-6 py-4 whitespace-nowrap font-medium">${scenario.name}</td><td class="px-6 py-4 whitespace-nowrap">${finalYears}</td><td class="px-6 py-4 whitespace-nowrap text-green-600 font-semibold">${yearsSaved > 0 ? yearsSaved : '0.0'}</td><td class="px-6 py-4 whitespace-nowrap text-green-600 font-semibold">${interestSaved > 0 ? interestSaved : '0.00'}</td></tr>`;
        });

        summaryTable += `</tbody></table></div>`;
        const htmlContent = `<div class="flex flex-col w-full gap-6 text-left"><h2 class="text-xl font-semibold text-gray-800 text-center">Análisis Comparativo de Prepagos</h2>${summaryTable}<div id="prepaymentChartContainer" class="relative w-full mt-2" style="height: 400px;"></div></div>`;
        displayResults(htmlContent);
        
        renderPrepaymentChart({
            noPrepayment: fullNoPrepaymentData.schedule,
            base: baseData.schedule,
            double: doubleData.schedule
        });
    }, 500);
}

function handleComparison() {
    const inputs = getInputs();
    if (typeof inputs === 'string') { displayError(inputs); return; }
    const { principal, annualRate, totalMonths, paidMonths, annualLimit, frequencyMonths, prepaymentStartMonth } = inputs;
    displayLoading();

    setTimeout(() => {
        const noPrepaymentData = generateSchedule(principal, annualRate, totalMonths);
        const prepaymentAmount = annualLimit / (12 / frequencyMonths);
        const prepaymentRule = (month, balance) => (month >= prepaymentStartMonth && (month - prepaymentStartMonth) % frequencyMonths === 0) ? prepaymentAmount : 0;
        const prepaymentData = generateSchedule(principal, annualRate, totalMonths, prepaymentRule);
        
        fullScheduleData = { noPrepayment: noPrepaymentData, prepayment: prepaymentData, inputs };

        const noPrepMetrics = noPrepaymentData.metrics;
        const prepMetrics = prepaymentData.metrics;
        const monthsSaved = noPrepMetrics.finalMonths - prepMetrics.finalMonths;
        const interestSaved = (noPrepMetrics.totalInterest - prepMetrics.totalInterest);

        const htmlContent = `
            <div class="flex flex-col w-full gap-6 text-left">
                <h2 class="text-xl font-semibold text-gray-800 text-center">Resumen Comparativo</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 w-full gap-8">
                    <div class="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 class="text-lg font-medium text-blue-600">Escenario Sin Prepago</h3>
                        <p class="text-gray-700"><strong>Plazo final:</strong> ${noPrepMetrics.finalMonths} meses (${(noPrepMetrics.finalMonths/12).toFixed(1)} años)</p>
                        <p class="text-gray-700"><strong>Total intereses pagados:</strong> ${noPrepMetrics.totalInterest.toFixed(2)} UF</p>
                    </div>
                    <div class="space-y-2 p-4 bg-green-50 rounded-lg border border-green-200">
                        <h3 class="text-lg font-medium text-green-600">Escenario Con Prepago</h3>
                        <p class="text-gray-700"><strong>Plazo final:</strong> ${prepMetrics.finalMonths} meses (${(prepMetrics.finalMonths/12).toFixed(1)} años)</p>
                        <p class="text-gray-700"><strong>Total intereses pagados:</strong> ${prepMetrics.totalInterest.toFixed(2)} UF</p>
                        <p class="font-bold text-green-700 mt-2"><strong>Ahorro total:</strong> ${monthsSaved} meses y ${interestSaved.toFixed(2)} UF en intereses.</p>
                    </div>
                </div>
                <div id="explanation" class="hidden mt-4 p-4 bg-gray-100 rounded-lg text-gray-800"></div>
                <div class="flex flex-wrap justify-center gap-4 border-t border-gray-300/80 pt-6">
                    <button id="btnShowBalanceChart" class="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-5 rounded-lg transition-all duration-200 shadow-md">Evolución de Saldo</button>
                    <button id="btnShowInterestChart" class="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-5 rounded-lg transition-all duration-200 shadow-md">Intereses Acumulados</button>
                    <button id="btnExportExcel" class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-lg transition-all duration-200 shadow-md">Exportar a Excel</button>
                </div>
                <div id="chartContainer" class="relative w-full mt-2" style="height: 400px;"></div>
            </div>`;
        displayResults(htmlContent);
        
        document.getElementById('btnShowBalanceChart').addEventListener('click', () => renderComparisonChart('balance'));
        document.getElementById('btnShowInterestChart').addEventListener('click', () => renderComparisonChart('interest'));
        document.getElementById('btnExportExcel').addEventListener('click', handleExportToExcel);
        
        renderComparisonChart('balance');
    }, 500);
}

function handleExplain() {
    const explanationDiv = document.getElementById('explanation');
    if (!fullScheduleData || !explanationDiv) {
        displayError("Primero debes 'Comparar Escenarios' para poder explicar los resultados.");
        return;
    }

    explanationDiv.classList.toggle('hidden'); // Muestra u oculta la explicación

    const { noPrepayment, prepayment, inputs } = fullScheduleData;
    const interestSaved = (noPrepayment.metrics.totalInterest - prepayment.metrics.totalInterest).toFixed(2);
    const monthsSaved = noPrepayment.metrics.finalMonths - prepayment.metrics.finalMonths;
    const yearsSaved = (monthsSaved / 12).toFixed(1);
    const prepaymentAmount = inputs.annualLimit / (12 / inputs.frequencyMonths);

    explanationDiv.innerHTML = `
        <h4 class="font-bold text-md mb-2">¿Qué significan estos resultados?</h4>
        <p class="text-sm">Al realizar un prepago de <strong>${prepaymentAmount.toFixed(2)} UF</strong> de forma ${inputs.frequencyMonths === 12 ? 'anual' : 'semestral'} a partir del mes ${inputs.prepaymentStartMonth}, logras lo siguiente:</p>
        <ul class="list-disc list-inside mt-2 text-sm space-y-1">
            <li><strong>Pagas tu crédito antes:</strong> Terminas de pagar en <strong>${prepayment.metrics.finalMonths} meses</strong>, en lugar de ${noPrepayment.metrics.finalMonths}. ¡Te ahorras <strong>${monthsSaved} meses</strong> (aproximadamente ${yearsSaved} años)!</li>
            <li><strong>Ahorras dinero en intereses:</strong> El ahorro más significativo es en los intereses. Pagas un total de <strong>${interestSaved} UF</strong> menos al banco durante la vida del crédito.</li>
        </ul>
        <p class="text-xs mt-3 text-gray-600"><strong>En resumen:</strong> Cada prepago va directamente a reducir tu deuda (el capital), lo que causa que los intereses de los meses siguientes se calculen sobre un monto menor. Este efecto "bola de nieve" es lo que genera el gran ahorro a largo plazo.</p>
    `;
}


// --- Funciones de Exportación y Gráficos ---
function handleExportToExcel() {
    if (!fullScheduleData) {
        displayError("Primero debes 'Comparar Escenarios' para generar los datos de exportación.");
        return;
    }
    try {
        const wsNoPrepayment = XLSX.utils.json_to_sheet(fullScheduleData.noPrepayment.schedule);
        const wsPrepayment = XLSX.utils.json_to_sheet(fullScheduleData.prepayment.schedule);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsNoPrepayment, "Sin Prepago");
        XLSX.utils.book_append_sheet(wb, wsPrepayment, "Con Prepago");
        XLSX.writeFile(wb, "Simulacion_Credito_Hipotecario.xlsx");
    } catch (error) {
        console.error("Error al exportar a Excel:", error);
        displayError("Ocurrió un error al generar el archivo Excel.");
    }
}

function renderComparisonChart(type) {
    if (typeof echarts === 'undefined') {
        displayError("Error: La librería de gráficos (ECharts) no se pudo cargar. Revisa tu conexión a internet o si alguna extensión del navegador la está bloqueando.");
        return;
    }
    const chartContainer = document.getElementById('chartContainer');
    if (!chartContainer || !fullScheduleData) return;

    if (echartInstance) echartInstance.dispose();
    echartInstance = echarts.init(chartContainer);

    const noPrepSchedule = fullScheduleData.noPrepayment.schedule;
    const prepSchedule = fullScheduleData.prepayment.schedule;
    
    let noPrepChartData = noPrepSchedule.map(d => type === 'balance' ? parseFloat(d['Saldo Pendiente (UF)']) : parseFloat(d['Interés (UF)']));
    let prepChartData = prepSchedule.map(d => type === 'balance' ? parseFloat(d['Saldo Pendiente (UF)']) : parseFloat(d['Interés (UF)']));
    
    if (type === 'interest') {
        noPrepChartData = noPrepChartData.reduce((acc, val, i) => [...acc, (i > 0 ? acc[i - 1] : 0) + val], []);
        prepChartData = prepChartData.reduce((acc, val, i) => [...acc, (i > 0 ? acc[i - 1] : 0) + val], []);
    }

    const labels = Array.from({ length: noPrepSchedule.length }, (_, i) => i + 1);
    const dataPrepPadded = prepChartData.concat(Array(noPrepSchedule.length - prepSchedule.length).fill(null));

    const option = {
        title: { text: type === 'balance' ? 'Evolución del Saldo del Crédito' : 'Acumulación de Intereses', left: 'center' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['Sin Prepago', 'Con Prepago'], bottom: 10 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: labels, name: 'Meses del Crédito', nameLocation: 'middle', nameGap: 35 },
        yAxis: { type: 'value', name: 'UF' },
        series: [
            { name: 'Sin Prepago', type: 'line', smooth: true, data: noPrepChartData, areaStyle: {} },
            { name: 'Con Prepago', type: 'line', smooth: true, data: dataPrepPadded, areaStyle: {} }
        ]
    };
    echartInstance.setOption(option);
}

function renderPrepaymentChart(schedules) {
    if (typeof echarts === 'undefined') {
        displayError("Error: La librería de gráficos (ECharts) no se pudo cargar. Revisa tu conexión a internet o si alguna extensión del navegador la está bloqueando.");
        return;
    }
    const chartContainer = document.getElementById('prepaymentChartContainer');
    if (!chartContainer) return;

    if (echartInstance) echartInstance.dispose();
    echartInstance = echarts.init(chartContainer);

    const { noPrepayment, base, double } = schedules;
    
    const createMarkPoint = (schedule, seriesColor) => {
        const finalMonth = schedule.length;
        if (finalMonth === 0) return {};
        const finalYear = (finalMonth / 12).toFixed(1);
        return {
            name: 'Fin del Crédito', coord: [finalMonth - 1, 0], value: `Año ${finalYear}`,
            symbol: 'circle', symbolSize: 12,
            itemStyle: { color: seriesColor, borderColor: '#fff', borderWidth: 2, shadowColor: 'rgba(0, 0, 0, 0.3)', shadowBlur: 5 },
            label: { show: true, position: 'top', formatter: '{c}', color: '#333', fontWeight: 'bold', distance: 10 }
        };
    };

    const seriesColors = { noPrepayment: '#3b82f6', base: '#10b981', double: '#8b5cf6' };
    const maxMonths = noPrepayment.length;
    const labels = Array.from({ length: maxMonths }, (_, i) => i + 1);

    const option = {
        title: { text: 'Evolución del Saldo con Diferentes Estrategias de Prepago', left: 'center' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['Sin Prepago', 'Límite Anual (Usuario)', 'Doble Límite'], bottom: 10 },
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: labels, name: 'Meses del Crédito', nameLocation: 'middle', nameGap: 35 },
        yAxis: { type: 'value', name: 'Saldo Pendiente (UF)' },
        series: [
            { name: 'Sin Prepago', type: 'line', smooth: true, data: noPrepayment.map(d => parseFloat(d['Saldo Pendiente (UF)'])), itemStyle: { color: seriesColors.noPrepayment }, markPoint: { data: [createMarkPoint(noPrepayment, seriesColors.noPrepayment)] } },
            { name: 'Límite Anual (Usuario)', type: 'line', smooth: true, data: base.map(d => parseFloat(d['Saldo Pendiente (UF)'])), itemStyle: { color: seriesColors.base }, markPoint: { data: [createMarkPoint(base, seriesColors.base)] } },
            { name: 'Doble Límite', type: 'line', smooth: true, data: double.map(d => parseFloat(d['Saldo Pendiente (UF)'])), itemStyle: { color: seriesColors.double }, markPoint: { data: [createMarkPoint(double, seriesColors.double)] } }
        ]
    };
    echartInstance.setOption(option);
}

// --- Event Listeners ---
btnSummary.addEventListener('click', handleSummary);
btnPrepayment.addEventListener('click', handlePrepayment);
btnCompare.addEventListener('click', handleComparison);
btnExplain.addEventListener('click', handleExplain);


