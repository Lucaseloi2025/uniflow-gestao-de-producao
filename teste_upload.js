import fs from 'fs';

async function run() {
    const form = new FormData();
    form.append('client_name', 'Teste RLS CLI');
    form.append('product_type', 'Dry Fit');
    form.append('print_type', 'Silk');
    form.append('quantity', '1');
    form.append('deadline', '2026-12-31');

    const fileContent = Buffer.from('conteudo de teste');

    // Criar um blob simulando um arquivo para o fetch nativo do node 24
    const blob = new Blob([fileContent], { type: 'image/jpeg' });
    form.append('art_file', blob, 'teste.jpg');

    try {
        const res = await fetch('https://uniflow-gestao-de-producao.vercel.app/api/orders', {
            method: 'POST',
            body: form
        });
        console.log('STATUS:', res.status);
        const text = await res.text();
        console.log('RESPONSE:', text);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
run();
