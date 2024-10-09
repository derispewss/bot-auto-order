import { WASocket, proto, getContentType } from '@whiskeysockets/baileys';
import { fetchUserById, insertUser, checkUserRegistered, deductBalance, updateBalance } from '../controllers/usersController'
import { addProduct, deleteProduct, editProduct, getProductByCode, readProducts, updateProductStatus, addStocks, takeProduct } from '../controllers/productControllers'
import { readFileSync } from 'fs';
import { formatUnixTimestamp, formatIDR } from '../utils/format';
import path from 'path'
import { P } from 'pino';

// Config types
interface Config {
    allowAccess: string[];
    messageOwner: string;
}

/**
 * Handles incoming messages.
 * 
 * @param sock - The WhatsApp socket connection.
 * @param msg - The incoming message object.
 */
module.exports = async (sock: WASocket, msg: proto.IWebMessageInfo) => {
    const configPath = path.resolve(__dirname, '../../config.json');
    const { allowAccess, messageOwner }: Config = JSON.parse(readFileSync(configPath, 'utf-8'));

    // Determine the type of message and extract the content
    const type = getContentType(msg.message!);
    const from = msg.key.remoteJid as string;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || msg.participant) as string : from;

    // Handle different message types
    const chats: string = 
        type === 'conversation' ? msg.message?.conversation || '' :
        type === 'imageMessage' && msg.message?.imageMessage?.caption ? msg.message.imageMessage.caption :
        type === 'documentMessage' && msg.message?.documentMessage?.caption ? msg.message.documentMessage.caption :
        type === 'videoMessage' && msg.message?.videoMessage?.caption ? msg.message.videoMessage.caption :
        type === 'extendedTextMessage' && msg.message?.extendedTextMessage?.text ? msg.message.extendedTextMessage.text :
        type === 'buttonsResponseMessage' && msg.message?.buttonsResponseMessage?.selectedButtonId ? msg.message.buttonsResponseMessage.selectedButtonId :
        type === 'templateButtonReplyMessage' && msg.message?.templateButtonReplyMessage?.selectedId ? msg.message.templateButtonReplyMessage.selectedId :
        type === 'listResponseMessage' ? msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '' :
        type === 'messageContextInfo' ? msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId || '' :
        '';

    const mentionByTag = type == "extendedTextMessage" && msg.message.extendedTextMessage.contextInfo != null ? msg.message.extendedTextMessage.contextInfo.mentionedJid : []
    const mention = typeof (mentionByTag) == 'string' ? [mentionByTag] : mentionByTag
    const command = chats.trim().split(' ')[0].toLowerCase() || '';
    const bodyMessage = 
        type === 'conversation' ? msg.message?.conversation || '' :
        type === 'extendedTextMessage' ? msg.message?.extendedTextMessage?.text || '' : '';
    
    const isAllow = allowAccess.includes(sender);
    const args = bodyMessage.trim().split(' ').slice(1);
    const q = args.join(' ');

    // Detect prefix
    const prefixMatch = chats.match(/^[°•π÷×¶∆£¢€¥®™✓_=|~!?#$%^&.+-,\/\\©^]/gi);
    const prefix = prefixMatch ? prefixMatch[0] : '#';

    // Function to reply to a message
    const reply = async (text: string): Promise<void> => {
        await sock.sendMessage(from, { text: text.trim() }, { quoted: msg });
    };

    function mentions(teks: string, mems: string[] = [], id?: any): any {
        if (id == null || id === false) {
            const res = sock.sendMessage(from, { text: teks, mentions: mems });
            return res;
        } else {
            const res = sock.sendMessage(from, { text: teks, mentions: mems }, { quoted: msg });
            return res;
        }
    }
    
    // Mark message as read
    await sock.readMessages([msg.key]);
    await sock.sendPresenceUpdate('available', from);

    console.log(`--- 📩 Message Receive 📩 ---`);
    console.log(`Message From: ${sender}`);
    console.log(`Type: ${type}`);
    console.log(`Chats: ${chats}`);
    console.log(`------------------------------`);

    switch (command) {
        case `${prefix}register`: {
            try {
                const { registered } = await checkUserRegistered(sender);
                if (registered) {
                    await reply('You are already registered.');
                    return;
                }
                const createdAt = Math.floor(Date.now() / 1000); 
                const initialBalance = 0;
                const { error: insertError } = await insertUser(sender, initialBalance, createdAt);
                if (insertError) {
                    await reply('An error occurred while registering the user.');
                    console.error(insertError);
                    return;
                }
                await reply('Registration successful! You are now registered.');
            } catch (error) {
                await reply('An unexpected error occurred during registration.');
            }
            break;
        }
        
        case `${prefix}myacc`: {
            const phoneNumber = sender.replace('@s.whatsapp.net', '');
            try {
                const user = await fetchUserById(sender);
                if (!user) {
                    await reply('Account not found. Please register first using the command #register.');
                    return;
                }
                await reply(`*Your Account Info*\n\n` +
                    `📱 *User:* +${phoneNumber}\n` +
                    `💰 *Balance:* ${formatIDR(user?.data?.balance)}\n` +
                    `🕐 *Joined:* ${formatUnixTimestamp(user?.data?.createdat)}`);
            } catch (error) {
                console.error(error);
                await reply('An error occurred while fetching your account information.');
            }
            break;
        }

        case `${prefix}deposit`: {
            try {
                if (!isAllow) {
                    await reply('This command is only for admin!');
                    return;
                }
                const user = mention[0];
                const amountStr = args[1];
                const amount = parseInt(amountStr, 10);
                if (isNaN(amount) || amount <= 0) {
                    await reply('Please provide a valid amount to add.');
                    return;
                }
                const data = await fetchUserById(user);
                if (!data) {
                    await reply('Account not found. Please register first using the command #register.');
                    return;
                }
                const result = await updateBalance(data.data.user_id, amount);
                const balance = result.data as number;
                await reply(`Successfully added *${formatIDR(amount)}* to your balance. Your new balance is *${formatIDR(balance + amount)}*.`);
                await sock.sendMessage(user, { text: `Deposit Successful!\n\nAmount Added: ${formatIDR(amount)}\nNew Balance: ${formatIDR(balance + amount)}` });
            } catch (error) {
                console.error(error);
                await reply('An error occurred while adding balance.');
            }
            break;
        }
        
        case `${prefix}deduct`: {
            try {
                if (!isAllow) {
                    await reply('This command is only for admin!');
                    return;
                }
                const user = mention[0];
                const amountStr = args[1];
                const amount = parseInt(amountStr, 10);
                if (isNaN(amount) || amount <= 0) {
                    await reply('Please provide a valid amount to deduct.');
                    return;
                }
                const data = await fetchUserById(user);
                if (!data) {
                    await reply('Account not found. Please register first using the command #register.');
                    return;
                }
                const userBalance: number = data.data.balance || 0;
                if (userBalance < amount) {
                    await reply(`Insufficient balance. Your current balance is *${formatIDR(userBalance)}*.`);
                    return;
                }
                await deductBalance(data.data.user_id, amount);
                await reply(`Successfully deducted *${formatIDR(amount)}* from your balance.`);
                await sock.sendMessage(user, { text: `Deduction Successful!\n\nAmount Deducted: ${formatIDR(amount)}\nNew Balance: ${formatIDR(userBalance - amount)}` });
            } catch (error) {
                console.error(error);
                await reply('An error occurred while deducting balance.');
            }
            break;
        }        
        
        case `${prefix}help`: {
            try {
                reply(`*Menu Admin Hara's Store*\n\n` +
                    `${prefix}register - Register yourself to use the bot.\n` +
                    `${prefix}myacc - Get details about your account, including balance and join date.\n` +
                    `${prefix}help - Display available commands and their usage.\n` +
                    `${prefix}add <codeProduct>|<productName>|<productPrice>|<productDesc>|<stocks> - Add a product to the store with an initial stock (1-10 items).\n` +
                    `${prefix}addstocks <codeProduct>|<newStocks> - Add more stock to an existing product (up to 10 total items).\n` +
                    `${prefix}delete <codeProduct> - Remove a product from the store.\n` +
                    `${prefix}updatestatus <codeProduct>|<status> - Change the status of a product (aktif or nonaktif).\n` +
                    `${prefix}edit <codeProduct>|<newProductName>|<newProductDesc>|<newProductPrice>|<newStocks> - Modify the name, description, price, or stock of a product.\n` +
                    `${prefix}stock - Get a list of all products in the store, including stock information.\n` +
                    `${prefix}buyapp <codeProduct>|<metodePayment> - Buy an application available in the store and deduct stocks.\n`);
            } catch (error) {
                reply('An error occurred while fetching help information.');
            }
            break;
        }        
    
        case `${prefix}add`: {
            try {
                if (isGroup) {
                    await reply('This command is for personal chats only.');
                    return;
                }
                if (!isAllow) {
                    await reply('This command is only for admin!');
                    return;
                }
                if (!args.length) {
                    await reply(`${prefix}add <codeProduct>|<productName>|<productPrice>|<productDesc>|<stock1>|<stock2>|...`);
                    return;
                }
                const [codeProduct, productName, productPriceStr, productDesc, ...stocks] = q.split('|').map(part => part.trim());
                if (!codeProduct || !productName || !productPriceStr || !productDesc || stocks.length === 0) {
                    await reply('Invalid input. Please use the format: codeProduct|productName|productPrice|productDesc|stock1|stock2|...');
                    return;
                }
                const productPrice: number = parseInt(productPriceStr, 10);
                if (isNaN(productPrice)) {
                    await reply('Invalid product price. Please enter a valid number for product price.');
                    return;
                }
                const result = await addProduct(codeProduct, productName, productPrice, true, productDesc, stocks);
                reply(result);
            } catch (error) {
                console.error(error);
                await reply('An error occurred while adding the product.');
            }
            break;
        }

        case `${prefix}addstock`: {
            try {
                if (isGroup) {
                    reply('This command is for personal chats only.');
                    return;
                }
                if (!isAllow) {
                    await reply('This command is only for admin!');
                    return;
                }
                if (!args.length) {
                    await reply(`${prefix}addstock <codeProduct>|<stock1>|<stock2>|...`);
                    return;
                }
                const [codeProduct, ...newStocks] = q.split('|').map(part => part.trim());
                if (!codeProduct || newStocks.length < 1 || newStocks.length > 10) {
                    await reply('You must specify a valid product code and add between 1 and 10 stocks.');
                    return;
                }
                const result = await addStocks(codeProduct, newStocks);
                await reply(result);
            } catch (error) {
                console.error(error);
                await reply('An error occurred while adding stocks.');
            }
            break;
        }
        
    
        case `${prefix}delete`: {
            try {
                if (isGroup) {
                    await reply('This command is for personal chats only.');
                    return;
                }
                if (!isAllow) {
                    await reply('This command is only for admin!');
                    return;
                }
                if (!args.length) {
                    await reply(`${prefix}delete <codeProduct1>|<codeProduct2>|...`);
                    return
                }
                const codeProducts = q.split('|').map(part => part.trim()).filter(Boolean);
                const result = await deleteProduct(codeProducts);
                await reply(result);
            } catch (error) {
                console.error(error);
                await reply('An error occurred while deleting products.');
            }
            break;
        }
        
        case `${prefix}updatestatus`: {
            try {
                if (isGroup) {
                    await reply('This command is for personal chats only.');
                    return;
                }
                if (!isAllow) {
                    await reply('This command is only for admin!');
                    return;
                }
                if (!args.length) {
                    await reply(`Usage: ${prefix}updatestatus <codeProduct>|<status>`);
                    return;
                }
                let [codeProduct, statusString] = q.split('|');
                const status: boolean = statusString.toLowerCase() === 'aktif';
                const response = await updateProductStatus(codeProduct, status);
                await reply(response);
            } catch (error) {
                await reply('An error occurred while updating the product status.');
            }
            break;
        }
        
        case `${prefix}edit`: {
            try {
                if (isGroup) {
                    await reply('This command is for personal chats only.');
                    return;
                }
                if (!isAllow) {
                    await reply('This command is only for admin!');
                    return;
                }
                if (!args.length) {
                    await reply(`Usage: ${prefix}edit <codeProduct>|<newProductName>|<newProductDesc>|<newProductPrice> (use "-" to skip updating a parameter)`); 
                    return;
                }
                const [codeProduct, newProductName, newProductDesc, newProductPrice] = q.split('|');
                const response = await editProduct(codeProduct, newProductName, newProductDesc, newProductPrice);
                await reply(response);
            } catch (error) {
                console.error(error);
                await reply('An error occurred while editing the product.');
            }
            break;
        }
        
        case `${prefix}stock`: {
            try {
                let products = await readProducts();
                if (typeof products === 'string') {
                    await reply(products);
                    return;
                }
                if (products.length === 0) {
                    await reply('No products available.');
                    return;
                }
                let productUpdated = false;
                for (const product of products) {
                    const stockCount = product.stocks ? product.stocks.length : 0;
                    if (stockCount === 0 && product.status) {
                        await updateProductStatus(product.codeProduct, false);
                        productUpdated = true;
                    }
                }
                if (productUpdated) {
                    products = await readProducts();
                    if (typeof products === 'string') {
                        await reply(products);
                        return;
                    }
                }
                let productList = '*Product List*\n\n';
                products.forEach(product => {
                    const stockCount = product.stocks ? product.stocks.length : 0;
                    productList += `🛒 *Code:* ${product.codeProduct}\n`;
                    productList += `📦 *Name:* ${product.productName}\n`;
                    productList += `💰 *Price:* ${formatIDR(product.productPrice)}\n`;
                    productList += `📄 *Description:* ${product.productDesc}\n`;
                    productList += `✅ *Status:* ${product.status ? 'Available' : 'Unavailable'}\n`;
                    productList += `📦 *Stocks:* ${stockCount}\n\n`;
                });
                await reply(productList.trim());
            } catch (error) {
                console.error(error);
                await reply('An error occurred while retrieving the product list.');
            }
            break;
        }        
    
        case `${prefix}buyapp`: {
            try {
                if (isGroup) {
                    await reply('This command is for personal chats only.');
                    return;
                }
                const [codeProduct, metodePayment] = q.split('|').map(arg => arg.trim());
                if (!codeProduct || !metodePayment) {
                    await reply(`Usage: ${prefix}buyapp <codeProduct>|<metodePayment (available payment method: 'saldo')>`);
                    return;
                }
                const product = await getProductByCode(codeProduct);
                if (typeof product === 'string') {
                    await reply(product);
                    return;
                }
                if(!product.status) {
                    await reply('products is unavailable, transaction failed!');
                    return;
                }
                if (metodePayment.toLowerCase() === 'saldo') {
                    const user = await fetchUserById(sender);
                    if (!user) {
                        await reply('Account not found. Please register first using the command #register.');
                        return;
                    }
                    const userBalance: number = user?.data?.balance || 0;
                    const productPrice: number = product.productPrice;
                    if (userBalance < productPrice) {
                        await reply(`Insufficient balance. You need ${formatIDR(productPrice - userBalance)} more.`);
                        return;
                    }
                    const stockResponse = await takeProduct(codeProduct);
                    if (typeof stockResponse === 'string') {
                        await reply(stockResponse);
                        return;
                    }
                    await deductBalance(sender, productPrice);
                    const { stockTaken } = stockResponse;
                    await reply(`Purchase successful!\n\nYou bought *${product.productName}* for *${formatIDR(productPrice)}*.\nRemaining balance: ${formatIDR(userBalance - productPrice)}.\n----- Taken stock -----\n${stockTaken}`);
                } else {
                    await reply(`Payment method '${metodePayment}' is not yet supported.`);
                    return
                }
            } catch (error) {
                console.error(error);
                await reply('An error occurred while processing your purchase.');
            }
            break;
        }
    }
};
