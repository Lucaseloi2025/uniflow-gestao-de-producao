async function run() {
    const formData = new FormData();
    formData.append('client_name', 'Teste RLS CLI');
    formData.append('product_type', 'Dry Fit');
    formData.append('print_type', 'Silk');
    formData.append('quantity', '1');
    formData.append('deadline', '2026-12-31');

    const fileContent = Buffer.from('conteudo de teste');
    // Usando Blob para compatibilidade com o fetch nativo do Node.js
    const blob = new Blob([fileContent], { type: 'image/jpeg' });
    
    // O backend espera 'art_files' (plural)
    formData.append('art_files', blob, 'teste.jpg');

    try {
        console.log('Enviando requisição para o backend...');
        const res = await fetch('https://uniflow-gestao-de-producao.vercel.app/api/orders', {
            method: 'POST',
            body: formData
        });
        console.log('STATUS:', res.status);
        const text = await res.text();
        console.log('RESPONSE:', text);
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
run();
