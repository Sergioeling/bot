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

// Mensajes del sistema
const MESSAGES = {
    welcome: `
🏥 *Bienvenido al Sistema de Citas Médicas*

Soy tu asistente virtual para gestionar tus citas médicas.
    
📌 *Servicios Disponibles:*
• Agendar nuevas citas
• Consultar tus citas
• Cancelar citas existentes
• Contacto de emergencia
    
¿En qué puedo ayudarte hoy?
    `,
    appointmentStart: `
🗓️ *Proceso de Agendamiento de Cita*
    
Por favor, selecciona la especialidad que necesitas:
    `,
    selectDate: `
📅 *Selecciona la fecha deseada*
    
Formato: DD/MM/YYYY
Ejemplo: 25/11/2024
    
_Solo fechas dentro de los próximos 30 días_
    `,
    appointmentConfirmation: (specialty, date, time) => `
✅ *Resumen de tu Cita*
    
👨‍⚕️ Especialidad: ${specialty}
📅 Fecha: ${date}
⏰ Hora: ${time}
    
¿Deseas confirmar esta cita?
    `,
    appointmentSuccess: `
✅ *¡Cita Agendada con Éxito!*
    
Recibirás un recordatorio 24 horas antes.
    
Recomendaciones:
• Llega 15 minutos antes
• Trae tu documento de identidad
• Trae tus exámenes previos si los tienes
    `,
    noAppointments: `
ℹ️ No tienes citas programadas actualmente.
    
Usa 🗓️ *Agendar Cita* para programar una nueva cita.
    `,
    error: `
❌ *Ha ocurrido un error*
    
Por favor, intenta nuevamente o contacta a soporte.
    `,
    emergencyContact: `
🚨 *Contactos de Emergencia*
    
🏥 Emergencias: 911
👨‍⚕️ Guardia Médica: +1 234 567 890
🚑 Ambulancia: +1 234 567 891
    
_En caso de emergencia, por favor contacta directamente a estos números._
    `
};

// Middleware para parsear JSON
app.use(bodyParser.json());

// Función mejorada para enviar mensajes
async function sendMessage(chatId, text, extra = {}) {
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
        console.error('Error al enviar mensaje:', error.response?.data || error.message);
        throw new Error('Error al enviar mensaje');
    }
}

// Función para generar horarios disponibles
function generateTimeSlots() {
    const timeSlots = {
        reply_markup: {
            inline_keyboard: []
        }
    };
    
    let currentRow = [];
    AVAILABLE_HOURS.forEach((time, index) => {
        currentRow.push({
            text: `⏰ ${time}`,
            callback_data: `time_${time}`
        });
        
        if (currentRow.length === 2 || index === AVAILABLE_HOURS.length - 1) {
            timeSlots.reply_markup.inline_keyboard.push([...currentRow]);
            currentRow = [];
        }
    });
    
    return timeSlots;
}

// Ruta principal para verificar el estado del bot
app.get('/', (req, res) => {
    res.send('Bot is running! 🚀');
});

// Webhook para Telegram
app.post('/', async (req, res) => {
    try {
        const update = req.body;
        
        // Manejo de mensajes de texto
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || '';
            
            switch (text) {
                case '/start':
                    await sendMessage(chatId, MESSAGES.welcome, MAIN_MENU);
                    break;
                    
                case '🗓️ Agendar Cita':
                    userStates.set(chatId, 'SELECTING_SPECIALTY');
                    await sendMessage(chatId, MESSAGES.appointmentStart, SPECIALTY_MENU);
                    break;
                    
                case '📋 Mis Citas':
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
                    }
                    break;
                    
                case '📞 Contacto Urgente':
                    await sendMessage(chatId, MESSAGES.emergencyContact);
                    break;

                case '❌ Cancelar Cita':
                    const userAppointments = tempAppointments.get(chatId) || [];
                    if (userAppointments.length === 0) {
                        await sendMessage(chatId, MESSAGES.noAppointments);
                    } else {
                        const cancelButtons = {
                            reply_markup: {
                                inline_keyboard: userAppointments.map((app, index) => ([{
                                    text: `❌ ${app.specialty} - ${app.date} ${app.time}`,
                                    callback_data: `cancel_${index}`
                                }]))
                            }
                        };
                        await sendMessage(chatId, '*Selecciona la cita que deseas cancelar:*', cancelButtons);
                    }
                    break;
                    
                default:
                    if (userStates.get(chatId) === 'ENTERING_DATE') {
                        const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
                        if (dateRegex.test(text)) {
                            tempAppointments.set(chatId, {
                                ...tempAppointments.get(chatId),
                                date: text
                            });
                            userStates.set(chatId, 'SELECTING_TIME');
                            await sendMessage(chatId, '⏰ Selecciona un horario disponible:', generateTimeSlots());
                        } else {
                            await sendMessage(chatId, '❌ Formato de fecha incorrecto. Por favor, usa DD/MM/YYYY');
                        }
                    }
            }
        }
        
        // Manejo de callbacks (botones)
        if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const chatId = callbackQuery.message.chat.id;
            const data = callbackQuery.data;
            
            if (data.startsWith('spec_')) {
                const specialty = SPECIALTIES[data.split('_')[1]];
                tempAppointments.set(chatId, { specialty });
                userStates.set(chatId, 'ENTERING_DATE');
                await sendMessage(chatId, MESSAGES.selectDate);
            }
            else if (data.startsWith('time_')) {
                const time = data.split('_')[1];
                const appointment = tempAppointments.get(chatId);
                appointment.time = time;
                
                // Guardar la cita
                const userAppointments = tempAppointments.get(chatId) || [];
                userAppointments.push(appointment);
                tempAppointments.set(chatId, userAppointments);
                
                // Enviar confirmación
                await sendMessage(
                    chatId,
                    MESSAGES.appointmentSuccess,
                    {
                        reply_markup: {
                            inline_keyboard: [[
                                {text: '📱 Añadir a Calendario', callback_data: 'add_calendar'},
                                {text: '📋 Ver mis Citas', callback_data: 'view_appointments'}
                            ]]
                        }
                    }
                );
                
                userStates.delete(chatId);
            }
            else if (data.startsWith('cancel_')) {
                const index = parseInt(data.split('_')[1]);
                const userAppointments = tempAppointments.get(chatId) || [];
                if (index >= 0 && index < userAppointments.length) {
                    const canceledAppointment = userAppointments[index];
                    userAppointments.splice(index, 1);
                    tempAppointments.set(chatId, userAppointments);
                    await sendMessage(chatId, `✅ Cita cancelada exitosamente:\n\n${canceledAppointment.specialty}\n📅 ${canceledAppointment.date}\n⏰ ${canceledAppointment.time}`);
                }
            }
            
            // Responder al callback query
            try {
                await axios.post(`${BASE_URL}answerCallbackQuery`, {
                    callback_query_id: callbackQuery.id
                });
            } catch (error) {
                console.error('Error al responder callback query:', error);
            }
        }
        
        res.status(200).send('ok');
    } catch (error) {
        console.error('Error en el manejador principal:', error);
        res.status(500).send('Error interno');
    }
});

// Configurar webhook al inicio
async function setupWebhook() {
    try {
        const webhookUrl = process.env.RENDER_EXTERNAL_URL || `https://your-app-name.onrender.com`;
        const response = await axios.post(`${BASE_URL}setWebhook`, {
            url: webhookUrl
        });
        console.log('Webhook configurado:', response.data);
    } catch (error) {
        console.error('Error configurando webhook:', error);
    }
}

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🏥 Bot de Citas Médicas Activo
📡 Puerto: ${PORT}
⏰ Iniciado: ${new Date().toLocaleString()}
✨ Listo para atender pacientes
🔗 URL: ${process.env.RENDER_EXTERNAL_URL || 'localhost'}
    `);
    setupWebhook();
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Promesa rechazada no manejada:', error);
});