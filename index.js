// index.js
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const TOKEN = '7233829367:AAGyzkwOoC5af3TeJ71h4QqSgrVTkRnpJ7I';
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

async function sendMessage(chatId, text) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

app.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (message) {
            const chatId = message.chat.id;
            const text = message.text;

            let response;
            switch (text) {
                case '/start':
                    response = 'Me has iniciado';
                    break;
                case '/info':
                    response = 'Hola! Soy @Sergioclo10 y estas usando mi bot';
                    break;
                default:
                    response = 'No te he entendido lo siento bro';
            }

            await sendMessage(chatId, response);
        }

        res.send('OK');
    } catch (error) {
        console.error('Error in webhook:', error);
        res.status(500).send('Error en el servidor');
    }
});

app.get('/', (req, res) => {
    res.send('¡Bot funcionando!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});