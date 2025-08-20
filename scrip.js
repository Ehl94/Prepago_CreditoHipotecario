document.addEventListener('DOMContentLoaded', () => {

    // --- Referencias a elementos del DOM ---
    const principalInput = document.getElementById('principal');
    const annualRateInput = document.getElementById('annualRate');
    const totalMonthsInput = document.getElementById('totalMonths');
    const paidMonthsInput = document.getElementById('paidMonths');
    const annualLimitInput = document.getElementById('annualLimit');
    const frequencyMonthsSelect = document.getElementById('frequencyMonths');
    const resultsDiv = document.getElementById('results');

    const btnSummary = document.getElementById('btnSummary');
    const btnPrepayment = document.getElementById('btnPrepayment');
    const btnCompare = document.getElementById('btnCompare');
    const btnExplain = document.getElementById('btnExplain');

    let chartInstance = null;
    let fullScheduleData = null; 

    // --- Funciones de Cálculo ---
    function calculateMonthlyRate(annualRate) {
        return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    }

    function frenchAmortization(principal, monthlyRate, totalMonths) {
        if (principal <= 0 || totalMonths <= 0) return 0;
        if (monthlyRate === 0) return principal / totalMonths;
        const factor = Math.pow(1 + monthlyRate, totalMonths);
        return principal * (monthlyRate * factor) / (factor - 1);
    }

    function generateSchedule(principal, annualRate, totalMonths, prepayments = {}) {
        const monthlyRate = calculateMonthlyRate(annualRate);
        let monthlyPayment = frenchAmortization(principal, monthlyRate, totalMonths);
        
        let balance = principal;
        let schedule = [];
        let totalInterest = 0;
        let totalPrincipalPaid = 0;

        for (let month = 0; month < totalMonths; month++) {
            if (balance < 0.01) break;

            const interest = balance * monthlyRate;
            let capitalPayment = monthlyPayment - interest;
            
            const prepayment = prepayments[month + 1] || 0;

            if (prepayment > 0) {
                balance -= prepayment;
                totalPrincipalPaid += prepayment;
                if (balance > 0) {
                    monthlyPayment = frenchAmortization(balance, monthlyRate, totalMonths - (month + 1));
                }
            }

            if (balance < capitalPayment) {
                capitalPayment = balance;
            }
            
            balance -= capitalPayment;
            totalInterest += interest;
            totalPrincipalPaid += capitalPayment;
            
            if (balance < 0.01) balance = 0;

            schedule.push({
                'Mes': month + 1,
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
    
    // --- Funciones de Interfaz ---
    function getInputs() {
        const principal = parseFloat(principalInput.value);
        const annualRate = parseFloat(annualRateInput.value);
        const totalMonths = parseInt(totalMonthsInput.value, 10);
        const paidMonths = parseInt(paidMonthsInput.value, 10) || 0;
        const annualLimit = parseFloat(annualLimitInput.value) || 0;
        const frequencyMonths = parseInt(frequencyMonthsSelect.value, 10);
        
        if (isNaN(principal) || principal <= 0) return "Por favor, ingrese un monto de crédito válido (> 0).";
        if (isNaN(annualRate) || annualRate < 0) return "Por favor, ingrese una tasa anual válida (>= 0).";
        if (isNaN(totalMonths) || totalMonths <= 0) return "Por favor, ingrese un plazo en meses válido (> 0).";
        if (paidMonths < 0 || paidMonths > totalMonths) return "Los meses pagados deben ser un número no negativo y menor o igual al plazo total.";

        return { principal, annualRate, totalMonths, paidMonths, annualLimit, frequencyMonths };
    }

    function displayError(message) {
        resultsDiv.innerHTML = `<p class="text-red-600 font-semibold">${message}</p>`;
    }

    function displayLoading() {
        resultsDiv.innerHTML = `<div class="flex items-center justify-center space-x-2"><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse"></div><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse" style="animation-delay: 0.2s;"></div><div class="w-4 h-4 rounded-full bg-blue-500 animate-pulse" style="animation-delay: 0.4s;"></div><span class="text-gray-600">Calculando...</span></div>`;
    }
    
    function displayResults(htmlContent) {
        resultsDiv.innerHTML = htmlContent;
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
    }

    // --- Handlers de Botones ---
    function handleSummary() {
         const inputs = getInputs();
        if (typeof inputs === 'string') { displayError(inputs); return; }
        const { principal, annualRate, totalMonths, paidMonths } = inputs;
        displayLoading();

        setTimeout(() => {
            const fullScheduleData = generateSchedule(principal, annualRate, totalMonths);
            const schedule = fullScheduleData.schedule;
            
            const monthlyPayment = schedule.length > 0 ? parseFloat(schedule[0]['Cuota (UF)']) : 0;
            const remainingBalance = paidMonths > 0 ? parseFloat(schedule[paidMonths - 1]['Saldo Pendiente (UF)']) : principal;
            const remainingMonths = totalMonths - paidMonths;

            const htmlContent = `<div class="space-y-4 text-left w-full"><h2 class="text-xl font-semibold text-gray-800">Resumen de tu Crédito Actual</h2><p class="text-gray-700"><strong>Monto Original (UF):</strong> ${principal.toFixed(2)}</p><p class="text-gray-700"><strong>Cuota mensual (UF):</strong> ${monthlyPayment.toFixed(4)}</p><p class="text-gray-700"><strong>Saldo pendiente (UF):</strong> ${remainingBalance.toFixed(2)}</p><p class="text-gray-700"><strong>Meses restantes:</strong> ${remainingMonths} (${(remainingMonths / 12).toFixed(1)} años)</p></div>`;
            displayResults(htmlContent);
        }, 500);
    }

    function handlePrepayment() {
        const inputs = getInputs();
        if (typeof inputs === 'string') { displayError(inputs); return; }
        const { principal, annualRate, totalMonths, paidMonths, annualLimit, frequencyMonths } = inputs;
        displayLoading();

        setTimeout(() => {
            if (annualLimit <= 0) { displayError("Para el plan de prepago, el límite anual debe ser mayor a 0."); return; }
            
            const noPrepData = generateSchedule(principal, annualRate, totalMonths);
            
            const prepayments = {};
            const prepaymentAmount = annualLimit / (12 / frequencyMonths);
            for (let i = frequencyMonths; i <= totalMonths; i += frequencyMonths) {
                prepayments[i] = prepaymentAmount;
            }
            const prepData = generateSchedule(principal, annualRate, totalMonths, prepayments);
            
            const monthsSaved = noPrepData.metrics.finalMonths - prepData.metrics.finalMonths;
            const interestSaved = noPrepData.metrics.totalInterest - prepData.metrics.totalInterest;

            const htmlContent = `<div class="space-y-4 text-left w-full"><h2 class="text-xl font-semibold text-gray-800">Métricas del Plan de Prepago</h2><p class="text-green-700 font-bold"><strong>Meses ahorrados:</strong> ${monthsSaved}</p><p class="text-green-700 font-bold"><strong>Intereses ahorrados (UF):</strong> ${interestSaved.toFixed(4)}</p><p class="text-gray-700"><strong>Nuevo plazo total:</strong> ${prepData.metrics.finalMonths} meses</p></div>`;
            displayResults(htmlContent);
        }, 500);
    }
    
    function handleComparison() {
        const inputs = getInputs();
        if (typeof inputs === 'string') { displayError(inputs); return; }
        const { principal, annualRate, totalMonths, paidMonths, annualLimit, frequencyMonths } = inputs;
        displayLoading();

        setTimeout(() => {
            const noPrepaymentData = generateSchedule(principal, annualRate, totalMonths);
            
            const prepayments = {};
            const prepaymentAmount = annualLimit / (12 / frequencyMonths);
            for (let i = frequencyMonths; i <= totalMonths; i += frequencyMonths) {
                prepayments[i] = prepaymentAmount;
            }
            const prepaymentData = generateSchedule(principal, annualRate, totalMonths, prepayments);
            
            fullScheduleData = { noPrepayment: noPrepaymentData, prepayment: prepaymentData };

            const noPrepMetrics = noPrepaymentData.metrics;
            const prepMetrics = prepaymentData.metrics;
            
            const monthsRemainingNoPrepayment = totalMonths - paidMonths;
            const totalInterestNoPrepayment = noPrepMetrics.totalInterest.toFixed(4);
            const totalAmortizationNoPrepayment = principal.toFixed(4);

            const monthsRemainingWithPrepayment = prepMetrics.finalMonths > paidMonths ? prepMetrics.finalMonths - paidMonths : 0;
            const yearsRemainingWithPrepayment = (monthsRemainingWithPrepayment / 12).toFixed(1);
            const totalInterestWithPrepayment = prepMetrics.totalInterest.toFixed(4);
            
            const monthsSaved = noPrepMetrics.finalMonths - prepMetrics.finalMonths;
            const interestSaved = (noPrepMetrics.totalInterest - prepMetrics.totalInterest).toFixed(4);

            const htmlContent = `
                <div class="flex flex-col w-full gap-6 text-left">
                    <h2 class="text-xl font-semibold text-gray-800 text-center">--- Resumen Comparativo ---</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 w-full gap-8">
                        <div class="space-y-2">
                            <h3 class="text-lg font-medium text-blue-600">Escenario Sin Prepago</h3>
                            <p class="text-gray-700"><strong>Meses restantes sin prepago:</strong> ${monthsRemainingNoPrepayment} (${(monthsRemainingNoPrepayment/12).toFixed(1)} años)</p>
                            <p class="text-gray-700"><strong>Total intereses pagados (UF):</strong> ${totalInterestNoPrepayment}</p>
                            <p class="text-gray-700"><strong>Total amortización (UF):</strong> ${totalAmortizationNoPrepayment}</p>
                        </div>
                        <div class="space-y-2">
                            <h3 class="text-lg font-medium text-green-600">Escenario Con Prepago</h3>
                            <p class="text-gray-700"><strong>Meses restantes con prepago:</strong> ${monthsRemainingWithPrepayment} (${yearsRemainingWithPrepayment} años)</p>
                            <p class="text-gray-700"><strong>Total intereses pagados (UF):</strong> ${totalInterestWithPrepayment}</p>
                            <p class="text-gray-700"><strong>Meses ahorrados:</strong> ${monthsSaved}</p>
                            <p class="font-bold text-green-700"><strong>Intereses ahorrados (UF):</strong> ${interestSaved}</p>
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

                    <div id="chartContainer" class="relative w-full mt-2 min-h-[300px] md:min-h-[400px]"></div>
                </div>
            `;
            displayResults(htmlContent);
            
            document.getElementById('btnShowBalanceChart').addEventListener('click', () => renderComparisonChart('balance'));
            document.getElementById('btnShowInterestChart').addEventListener('click', () => renderComparisonChart('interest'));
            document.getElementById('btnExportExcel').addEventListener('click', handleExportToExcel);
            
            renderComparisonChart('balance');
        }, 500);
    }

    function handleExportToExcel() {
        if (!fullScheduleData) { alert("Primero debes comparar los escenarios para generar los datos."); return; }
        try {
            const wsNoPrepayment = XLSX.utils.json_to_sheet(fullScheduleData.noPrepayment.schedule);
            const wsPrepayment = XLSX.utils.json_to_sheet(fullScheduleData.prepayment.schedule);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, wsNoPrepayment, "Sin Prepago");
            XLSX.utils.book_append_sheet(wb, wsPrepayment, "Con Prepago");
            XLSX.writeFile(wb, "Simulacion_Credito_Hipotecario.xlsx");
        } catch (error) {
            console.error("Error al exportar a Excel:", error);
            alert("Ocurrió un error al generar el archivo Excel.");
        }
    }

    function renderComparisonChart(type) {
        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer || !fullScheduleData) return;

        chartContainer.innerHTML = '<canvas id="comparisonChart"></canvas>';
        const ctx = document.getElementById('comparisonChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        const noPrepSchedule = fullScheduleData.noPrepayment.schedule;
        const prepSchedule = fullScheduleData.prepayment.schedule;
        
        let noPrepChartData = noPrepSchedule.map(d => type === 'balance' ? parseFloat(d['Saldo Pendiente (UF)']) : parseFloat(d['Interés (UF)']));
        let prepChartData = prepSchedule.map(d => type === 'balance' ? parseFloat(d['Saldo Pendiente (UF)']) : parseFloat(d['Interés (UF)']));
        
        if (type === 'interest') {
            noPrepChartData = noPrepChartData.reduce((acc, val) => [...acc, (acc.length > 0 ? acc[acc.length - 1] : 0) + val], []);
            prepChartData = prepChartData.reduce((acc, val) => [...acc, (acc.length > 0 ? acc[acc.length - 1] : 0) + val], []);
        }

        const labels = Array.from({ length: noPrepSchedule.length }, (_, i) => i + 1);
        const dataPrepPadded = Array(noPrepSchedule.length).fill(null);
        prepChartData.forEach((d, i) => { dataPrepPadded[i] = d; });

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Sin Prepago',
                    data: noPrepChartData,
                    borderColor: 'rgba(59, 130, 246, 0.8)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true, tension: 0.1
                }, {
                    label: 'Con Prepago',
                    data: dataPrepPadded,
                    borderColor: 'rgba(16, 185, 129, 0.8)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true, tension: 0.1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Mes del Crédito' } },
                    y: { title: { display: true, text: type === 'balance' ? 'Saldo Pendiente (UF)' : 'Intereses Acumulados (UF)' }, beginAtZero: true }
                },
                plugins: {
                    title: { display: true, text: type === 'balance' ? 'Evolución del Saldo del Crédito' : 'Acumulación de Intereses', font: { size: 16 } },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
    }
    
    // --- Event Listeners ---
    btnSummary.addEventListener('click', handleSummary);
    btnPrepayment.addEventListener('click', handlePrepayment);
    btnCompare.addEventListener('click', handleComparison);
});
