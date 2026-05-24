const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration de la connexion
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

app.post('/update-order-date', async (req, res) => {
    const { orderId, date } = req.body;
    const prefix = process.env.DB_PREFIX || 'ps_';

    if (!orderId || !date) {
        return res.status(400).json({ error: "Paramètres manquants (orderId ou date)" });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // 1. Update de la table orders (date création et mise à jour)
        const [resOrder] = await connection.execute(
            `UPDATE ${prefix}orders SET date_add = ?, date_upd = ? WHERE id_order = ?`,
            [date, date, orderId]
        );

        // 2. Update de l'historique (pour la cohérence du tunnel de vente)
        await connection.execute(
            `UPDATE ${prefix}order_history SET date_add = ? WHERE id_order = ?`,
            [date, orderId]
        );

        await connection.end();

        if (resOrder.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Commande non trouvée" });
        }

        console.log(`[SQL] Commande ${orderId} mise à jour à la date : ${date}`);
        res.json({ success: true, message: "Dates synchronisées en base de données" });

    } catch (error) {
        console.error("[Bridge Error]:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/update-cart-date', async (req, res) => {
    const { cartId, date } = req.body;
    const prefix = process.env.DB_PREFIX || 'ps_';

    if (!cartId || !date) {
        return res.status(400).json({ error: "Paramètres manquants (cartId ou date)" });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // 1. Update de la table carts (date création et mise à jour)
        const [resOrder] = await connection.execute(
            `UPDATE ${prefix}cart SET date_add = ?, date_upd = ? WHERE id_cart = ?`,
            [date, date, cartId]
        );

        await connection.end();

        if (resOrder.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Panier non trouvé" });
        }

        console.log(`[SQL] Panier ${cartId} mis à jour à la date : ${date}`);
        res.json({ success: true, message: "Dates synchronisées en base de données" });

    } catch (error) {
        console.error("[Bridge Error]:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/update-mvt-stock-date', async (req, res) => {
    const { mvtStockId, date } = req.body;
    const prefix = process.env.DB_PREFIX || 'ps_';

    if (!mvtStockId || !date) {
        return res.status(400).json({ error: "Paramètres manquants (mvtStockId ou date)" });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        
        // 1. Update de la table carts (date création et mise à jour)
        const [resOrder] = await connection.execute(
            `UPDATE ${prefix}stock_mvt SET date_add = ? WHERE id_stock_mvt = ?`,
            [date, mvtStockId]
        );

        await connection.end();

        if (resOrder.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Stock non trouvé" });
        }

        console.log(`[SQL] Stock ${mvtStockId} mis à jour à la date : ${date}`);
        res.json({ success: true, message: "Dates synchronisées en base de données" });

    } catch (error) {
        console.error("[Bridge Error]:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Bridge SQL actif sur http://localhost:${PORT}`);
});