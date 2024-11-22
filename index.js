const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const TOKEN = '7233829367:AAGyzkwOoC5af3TeJ71h4QqSgrVTkRnpJ7I';
const BASE_URL = `https://api.telegram.org/bot${TOKEN}/`;

// Middleware para parsear JSON
app.use(bodyParser.json());

// Función para enviar mensajes a Telegram - Equivalente exacto a la función send_message de Python
async function sendMessage(chatId, text) {
    const url = `${BASE_URL}sendMessage`;
    const data = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    };
    try {
        await axios.post(url, data);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Webhook - Equivalente exacto a la ruta webhook de Flask
app.all('/', async (req, res) => {
    // Manejo de GET request
    if (req.method === 'GET') {
        return res.status(200).send('¡Bot funcionando!');
    }
    
    // Manejo de POST request - igual que en Flask
    if (req.method === 'POST') {
        try {
            const update = req.body;
            
            if ('message' in update) {
                const chatId = update.message.chat.id;
                const message = update.message.text || '';
                
                let response;
                // Misma lógica de respuesta que en Flask
                if (message === '/start') {
                    response = 'Me has iniciado';
                } else if (message === '/info') {
                    response = 'Hola! Soy @Sergioclo10 y estas usando mi bot';
                } else {
                    response = 'No te he entendido lo siento bro';
                }
                
                await sendMessage(chatId, response);
            }
            
            return res.status(200).send('ok');
        } catch (error) {
            console.error(error);
            return res.status(500).send(error.toString());
        }
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});