import { supabase } from "../config/supabase";

export const fetchUserById = async (user_id: string) => {
    const { data, error } = await supabase
        .from('bot_auto_order')
        .select('*')
        .eq('user_id', user_id)
        .single();
    if (error) {
        console.error("Error fetching user:", error);
        return { error };
    }
    return { data };
};

export const checkUserRegistered = async (user_id: string) => {
    const { data: userData, error: fetchError } = await supabase
        .from('bot_auto_order')
        .select('id') 
        .eq('user_id', user_id)
        .single();
    if (fetchError) {
        console.error("Error fetching user:", fetchError);
        return { error: fetchError };
    }
    if (!userData) {
        return { registered: false, message: 'User not found or not registered' };
    }
    return { registered: true, message: 'User is registered' };
};

export const insertUser = async (user_id: string, balance: number, createdat: number) => {
    const { data, error } = await supabase
    .from('bot_auto_order')
    .insert([
        {
            user_id,
            balance,
            createdat
        }
    ]);
    if (error) {
        console.error("Error inserting user:", error);
        return { error };
    }
    return { data };
};

export const updateBalance = async (user_id: string, amountToAdd: number) => {
    const { data: userData, error: fetchError } = await supabase
        .from('bot_auto_order')
        .select('balance')
        .eq('user_id', user_id)
        .single();
    if (fetchError) {
        console.error("Error fetching balance:", fetchError);
        return { error: fetchError };
    }
    if (userData) {
        const currentBalance = userData.balance;
        const newBalance = currentBalance + amountToAdd;
        const { data: updatedData, error: updateError } = await supabase
            .from('bot_auto_order')
            .update({ balance: newBalance })
            .eq('user_id', user_id)
        if (updateError) {
            console.error("Error updating balance:", updateError);
            return { error: updateError };
        }
        return { data: updatedData };
    }
    return { error: 'User not found' };
};

export const deductBalance = async (user_id: string, amountToDeduct: number) => {
    const { data: userData, error: fetchError } = await supabase
        .from('bot_auto_order')
        .select('balance')
        .eq('user_id', user_id)
        .single();
    if (fetchError) {
        console.error("Error fetching balance:", fetchError);
        return { error: fetchError };
    }
    if (!userData) {
        return { error: 'User not found or not registered' };
    }
    const currentBalance = userData.balance;
    if (currentBalance < amountToDeduct) {
        return { error: 'Insufficient balance' };
    }
    const newBalance = currentBalance - amountToDeduct;
    const { data: updatedData, error: updateError } = await supabase
        .from('bot_auto_order')
        .update({ balance: newBalance })
        .eq('user_id', user_id)
    if (updateError) {
        console.error("Error updating balance:", updateError);
        return { error: updateError };
    }
    return { data: updatedData };
};