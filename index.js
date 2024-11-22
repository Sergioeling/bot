const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const TOKEN = '7233829367:AAGyzkwOoC5af3TeJ71h4QqSgrVTkRnpJ7I';
const BASE_URL = `https://api.telegram.org/bot${TOKEN}/`;

// Simulación de base de datos en memoria
let userStates = new Map();
let tempAppointments = new Map();

// Especialidades médicas disponibles
const SPECIALTIES = {
    GENERAL: 'Medicina General',
    CARDIO: 'Cardiología',
    DERMA: 'Dermatología',
    PEDIATRICS: 'Pediatría',
    DENTAL: 'Odontología'
};

// Horarios disponibles
const AVAILABLE_HOURS = [
    '09:00', '09:30', '10:00', '10:30', '11:00',
    '11:30', '14:00', '14:30', '15:00', '15:30'
];

// Configuración de botones y menús
const MAIN_MENU = {
    reply_markup: {
        keyboard: [
            ['🗓️ Agendar Cita', '📋 Mis Citas'],
            ['❌ Cancelar Cita', '📞 Contacto Urgente'],
            ['❓ Ayuda', '👤 Mi Perfil']
        ],
        resize_keyboard: true
    }
};

const SPECIALTY_MENU = {
    reply_markup: {
        inline_keyboard: Object.entries(SPECIALTIES).map(([key, value]) => ([
            {text: `👨‍⚕️ ${value}`, callback_data: `spec_${key}`}
        ]))
    }
};

const MESSAGES = {
    welcome: `
🏥 *Bienvenido al Sistema de Citas Médicas*

Por favor, selecciona una opción:

1️⃣ Agendar Cita
2️⃣ Mis Citas
3️⃣ Cancelar Cita
4️⃣ Contacto Urgente
5️⃣ Ayuda

_Escribe el número de la opción deseada (1-5)_
`,
    invalidOption: `
❌ *Opción no válida*

Por favor, selecciona una opción válida del menú:

1️⃣ Agendar Cita
2️⃣ Mis Citas
3️⃣ Cancelar Cita
4️⃣ Contacto Urgente
5️⃣ Ayuda
`,
    appointmentStart: `
🗓️ *Selecciona la Especialidad:*

1️⃣ Medicina General
2️⃣ Cardiología
3️⃣ Dermatología
4️⃣ Pediatría
5️⃣ Odontología

_Escribe el número de la especialidad (1-5)_
`,
    invalidSpecialty: `
❌ *Especialidad no válida*

Por favor, selecciona una especialidad válida (1-5):

1️⃣ Medicina General
2️⃣ Cardiología
3️⃣ Dermatología
4️⃣ Pediatría
5️⃣ Odontología
`,
    selectDate: `
📅 *Selecciona una fecha disponible:*

_Toca uno de los días disponibles en el calendario_
`,
    timeSelection: `
⏰ *Selecciona un horario disponible:*

_Toca uno de los horarios disponibles_
`,
    noAppointments: `
ℹ️ *No tienes citas programadas*

¿Qué deseas hacer?

1️⃣ Agendar nueva cita
5️⃣ Volver al menú principal

_Escribe el número de la opción deseada_
`,
    emergencyContact: `
🚨 *Contactos de Emergencia*

📞 Emergencias: 911
🏥 Guardia Médica: +1 234 567 890
🚑 Ambulancia: +1 234 567 891

_¿Qué deseas hacer?_

1️⃣ Volver al menú principal
`,
    help: `
❓ *Centro de Ayuda*

📋 *Comandos Disponibles:*
• /start - Iniciar/Reiniciar bot
• /menu - Mostrar menú principal
• /help - Mostrar esta ayuda

💡 *Tips:*
• Usa números (1-5) para seleccionar opciones
• Puedes cancelar cualquier proceso escribiendo "cancelar"
• Para emergencias, selecciona la opción 4

_¿Qué deseas hacer?_

1️⃣ Volver al menú principal
`,
    appointmentConfirmation: (specialty, date, time) => `
✅ *Confirma tu Cita*

👨‍⚕️ Especialidad: ${specialty}
📅 Fecha: ${date}
⏰ Hora: ${time}

¿Deseas confirmar esta cita?

1️⃣ Sí, confirmar
2️⃣ No, cancelar
`,
    appointmentSuccess: `
✅ *¡Cita Agendada con Éxito!*

Recordatorio:
• Llega 15 minutos antes
• Trae tu documento de identidad
• Trae tus exámenes previos si los tienes

Recibirás un recordatorio 24 horas antes.

1️⃣ Agendar otra cita
2️⃣ Ver mis citas
5️⃣ Volver al menú principal
`,
    cancelAppointment: (appointments) => `
❌ *Cancelar Cita*

Tus citas programadas:
${appointments.map((app, index) => `
${index + 1}. ${app.specialty}
📅 Fecha: ${app.date}
⏰ Hora: ${app.time}
`).join('\n')}

_Escribe el número de la cita que deseas cancelar_
`,
    appointmentCanceled: `
✅ *Cita Cancelada Exitosamente*

1️⃣ Agendar nueva cita
2️⃣ Ver mis citas
5️⃣ Volver al menú principal
`,
    cancelConfirm: (appointment) => `
⚠️ *¿Confirmas que deseas cancelar esta cita?*

👨‍⚕️ Especialidad: ${appointment.specialty}
📅 Fecha: ${appointment.date}
⏰ Hora: ${appointment.time}

1️⃣ Sí, cancelar cita
2️⃣ No, mantener cita
`,
    processing: `
⏳ *Procesando tu solicitud...*

Por favor, espera un momento.
`,
    error: `
❌ *Ha ocurrido un error*

Por favor, intenta nuevamente o selecciona una opción:

1️⃣ Reintentar
5️⃣ Volver al menú principal
`,
    sessionExpired: `
⚠️ *Sesión Expirada*

Tu sesión ha expirado por inactividad.
Por favor, selecciona una opción:

1️⃣ Continuar donde lo dejaste
5️⃣ Volver al menú principal
`
};

// Manejador principal mejorado
app.post('/', async (req, res) => {
    try {
        const update = req.body;
        
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text?.trim().toLowerCase() || '';
            
            // Comandos especiales
            if (text === '/start' || text === '/menu') {
                userStates.delete(chatId);
                await sendMessage(chatId, MESSAGES.welcome);
                return res.status(200).send('ok');
            }
            
            if (text === '/help') {
                await sendMessage(chatId, MESSAGES.help);
                return res.status(200).send('ok');
            }
            
            if (text === 'cancelar') {
                userStates.delete(chatId);
                await sendMessage(chatId, 'Proceso cancelado. Volviendo al menú principal...');
                await sendMessage(chatId, MESSAGES.welcome);
                return res.status(200).send('ok');
            }
            
            // Estado actual del usuario
            const currentState = userStates.get(chatId);
            
            // Manejo de menú principal
            if (!currentState) {
                if (/^[1-5]$/.test(text)) {
                    switch (text) {
                        case '1': // Agendar Cita
                            userStates.set(chatId, 'SELECTING_SPECIALTY');
                            await sendMessage(chatId, MESSAGES.appointmentStart);
                            break;
                            
                        case '2': // Mis Citas
                            const appointments = tempAppointments.get(chatId) || [];
                            if (appointments.length === 0) {
                                await sendMessage(chatId, MESSAGES.noAppointments);
                            } else {
                                const appointmentsList = appointments.map((app, index) => `
${index + 1}. ${app.specialty}
📅 Fecha: ${app.date}
⏰ Hora: ${app.time}
                                `).join('\n');
                                await sendMessage(chatId, `*Tus Citas Programadas:*\n${appointmentsList}`);
                                await sendMessage(chatId, MESSAGES.welcome);
                            }
                            break;
                            
                        case '3': // Cancelar Cita
                            const appsToCancel = tempAppointments.get(chatId) || [];
                            if (appsToCancel.length === 0) {
                                await sendMessage(chatId, MESSAGES.noAppointments);
                            } else {
                                userStates.set(chatId, 'SELECTING_CANCEL');
                                await sendMessage(chatId, MESSAGES.cancelAppointment(appsToCancel));
                            }
                            break;
                            
                        case '4': // Contacto Urgente
                            await sendMessage(chatId, MESSAGES.emergencyContact);
                            break;
                            
                        case '5': // Ayuda
                            await sendMessage(chatId, MESSAGES.help);
                            break;
                    }
                } else {
                    await sendMessage(chatId, MESSAGES.invalidOption);
                }
                return res.status(200).send('ok');
            }
            
            // Manejo de estados específicos
            switch (currentState) {
                case 'SELECTING_SPECIALTY':
                    if (/^[1-5]$/.test(text)) {
                        const specialty = SPECIALTY_MAP[text];
                        if (specialty) {
                            await sendMessage(chatId, MESSAGES.processing);
                            tempAppointments.set(chatId, { specialty });
                            userStates.set(chatId, 'SELECTING_DATE');
                            await sendMessage(chatId, MESSAGES.selectDate, generateCalendarKeyboard());
                        } else {
                            await sendMessage(chatId, MESSAGES.invalidSpecialty);
                        }
                    } else {
                        await sendMessage(chatId, MESSAGES.invalidSpecialty);
                    }
                    break;
                    
                case 'SELECTING_CANCEL':
                    const appointments = tempAppointments.get(chatId) || [];
                    const appointmentIndex = parseInt(text) - 1;
                    
                    if (appointmentIndex >= 0 && appointmentIndex < appointments.length) {
                        const appointmentToCancel = appointments[appointmentIndex];
                        userStates.set(chatId, 'CONFIRMING_CANCEL');
                        tempAppointments.set(chatId, {
                            ...tempAppointments.get(chatId),
                            cancelIndex: appointmentIndex
                        });
                        await sendMessage(chatId, MESSAGES.cancelConfirm(appointmentToCancel));
                    } else {
                        await sendMessage(chatId, 'Número de cita inválido. Por favor, selecciona un número válido.');
                        await sendMessage(chatId, MESSAGES.cancelAppointment(appointments));
                    }
                    break;
                    
                case 'CONFIRMING_CANCEL':
                    if (text === '1') {
                        const appointments = tempAppointments.get(chatId) || [];
                        const cancelIndex = tempAppointments.get(chatId).cancelIndex;
                        appointments.splice(cancelIndex, 1);
                        tempAppointments.set(chatId, appointments);
                        userStates.delete(chatId);
                        await sendMessage(chatId, MESSAGES.appointmentCanceled);
                    } else if (text === '2') {
                        userStates.delete(chatId);
                        await sendMessage(chatId, 'Cancelación abortada. Volviendo al menú principal...');
                        await sendMessage(chatId, MESSAGES.welcome);
                    } else {
                        await sendMessage(chatId, 'Opción no válida. Por favor, selecciona 1 para confirmar o 2 para cancelar.');
                    }
                    break;
                    
                default:
                    await sendMessage(chatId, MESSAGES.invalidOption);
                    break;
            }
        }
        
        // Manejo de callbacks (botones)
        if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const chatId = callbackQuery.message.chat.id;
            const data = callbackQuery.data;
            
            try {
                if (data.startsWith('date_')) {
                    const date = data.split('_')[1];
                    const appointment = tempAppointments.get(chatId) || {};
                    appointment.date = date;
                    tempAppointments.set(chatId, appointment);
                    userStates.set(chatId, 'SELECTING_TIME');
                    await sendMessage(chatId, MESSAGES.timeSelection, generateTimeSlots(date));
                }
                else if (data.startsWith('time_')) {
                    const time = data.split('_')[1];
                    const appointment = tempAppointments.get(chatId);
                    appointment.time = time;
                    
                    await sendMessage(
                        chatId,
                        MESSAGES.appointmentConfirmation(
                            appointment.specialty,
                            appointment.date,
                            appointment.time
                        ),
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: '✅ Confirmar', callback_data: 'confirm_yes' },
                                        { text: '❌ Cancelar', callback_data: 'confirm_no' }
                                    ]
                                ]
                            }
                        }
                    );
                }
                else if (data === 'confirm_yes') {
                    const appointment = tempAppointments.get(chatId);
                    const userAppointments = tempAppointments.get(chatId) || [];
                    userAppointments.push(appointment);
                    tempAppointments.set(chatId, userAppointments);
                    
                    await sendMessage(chatId, MESSAGES.appointmentSuccess);
                    userStates.delete(chatId);
                }
                else if (data === 'confirm_no') {
                    await sendMessage(chatId, '❌ Cita cancelada.');
                    await sendMessage(chatId, MESSAGES.welcome);
                    userStates.delete(chatId);
                }
                
                // Responder al callback query
                await axios.post(`${BASE_URL}answerCallbackQuery`, {
                    callback_query_id: callbackQuery.id
                });
            } catch (error) {
                console.error('Error procesando callback:', error);
                await sendMessage(chatId, MESSAGES.error);
            }
        }
        
        res.status(200).send('ok');
    } catch (error) {
        console.error('Error en el manejador principal:', error);
        res.status(500).send('Error interno');
    }
});

// Función mejorada de envío de mensajes con reintentos
async function sendMessage(chatId, text, extra = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const url = `${BASE_URL}sendMessage`;
            const data = {
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown',
                ...extra
            };
            const response = await axios.post(url, data);
            return response.data;
        } catch (error) {
            console.error(`Error enviando mensaje (intento ${i + 1}):`, error.response?.data || error.message);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}