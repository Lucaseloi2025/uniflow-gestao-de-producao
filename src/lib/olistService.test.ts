import {
  parseTinyXml,
  extractItemSizeAndProduct,
  isApprovedOlistStatus
} from './olistService';

function runTests() {
  console.log("=== Running Unit Tests for olistService ===");
  let passed = 0;
  let failed = 0;

  const assertEqual = (actual: any, expected: any, testName: string) => {
    if (actual === expected || JSON.stringify(actual) === JSON.stringify(expected)) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      failed++;
    }
  };

  // Test 1: Extract size and product title from description
  const ext1 = extractItemSizeAndProduct('Camiseta Gola Redonda Dry Comfort Branco – G', 'CM-BRA-G');
  assertEqual(ext1.size, 'G', 'Test 1.1: Size extracted from description (G)');

  const ext2 = extractItemSizeAndProduct('Camiseta Babylook Dry Comfort Azul – GG', 'CB-AZL-GG');
  assertEqual(ext2.size, 'GG', 'Test 1.3: Size extracted from description (GG)');

  const extG2 = extractItemSizeAndProduct('Camiseta Gola Redonda Dry Comfort Marrom - G2', 'CM-MAR-G2');
  assertEqual(extG2.size, 'G2', 'Test 1.4: Size G2 correctly extracted (Not G)');

  const extG5 = extractItemSizeAndProduct('Camiseta Dry Comfort Preto - G5', 'CM-PRE-G5');
  assertEqual(extG5.size, 'G5', 'Test 1.5: Size G5 correctly extracted');

  const extInf2 = extractItemSizeAndProduct('Camiseta Infantil Azul - Tam 2', 'INF-AZL-2');
  assertEqual(extInf2.size, '2', 'Test 1.6: Child size 2 extracted');

  const extInf10 = extractItemSizeAndProduct('Camiseta Infantil Azul - Tam 10', 'INF-AZL-10');
  assertEqual(extInf10.size, '10', 'Test 1.7: Child size 10 extracted');

  const ext3 = extractItemSizeAndProduct('Uniforme Personalizado', 'UNI-P');
  assertEqual(ext3.size, 'P', 'Test 1.8: Size extracted from SKU suffix when not in description');

  const ext4 = extractItemSizeAndProduct('Acessório Boné', 'ACC-001');
  assertEqual(ext4.size, 'Tamanho não informado', 'Test 1.9: Unidentified size defaults to Tamanho não informado (Not Único)');

  // Test 2: Check approved statuses
  assertEqual(isApprovedOlistStatus('Enviado'), true, 'Test 2.1: Enviado status is approved');
  assertEqual(isApprovedOlistStatus('Aprovado'), true, 'Test 2.2: Aprovado status is approved');
  assertEqual(isApprovedOlistStatus('Faturado'), true, 'Test 2.3: Faturado status is approved');
  assertEqual(isApprovedOlistStatus('Preparando envio'), true, 'Test 2.4: Preparando envio status is approved');
  assertEqual(isApprovedOlistStatus('Pendente'), false, 'Test 2.5: Pendente status is NOT approved');
  assertEqual(isApprovedOlistStatus('Cancelado'), false, 'Test 2.6: Cancelado status is NOT approved');

  // Test 3: XML Parsing of Tiny ERP response
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
  <retorno>
    <status_processamento>3</status_processamento>
    <status>OK</status>
    <pedidos>
      <pedido>
        <id>12345</id>
        <numero>99</numero>
        <nome>Cliente Teste</nome>
        <situacao>Aprovado</situacao>
        <cliente>
          <nome>Cliente Teste</nome>
          <email>cliente@teste.com</email>
        </cliente>
        <itens>
          <item>
            <id_produto>101</id_produto>
            <codigo>CM-P</codigo>
            <descricao>Camiseta Polo – P</descricao>
            <quantidade>10.00</quantidade>
          </item>
          <item>
            <id_produto>102</id_produto>
            <codigo>CM-M</codigo>
            <descricao>Camiseta Polo – M</descricao>
            <quantidade>15.00</quantidade>
          </item>
        </itens>
      </pedido>
    </pedidos>
  </retorno>`;

  const parsed = parseTinyXml(sampleXml);
  assertEqual(parsed.status, 'OK', 'Test 3.1: Parsed status OK');
  assertEqual(parsed.pedidos.length, 1, 'Test 3.2: Parsed 1 pedido block');
  assertEqual(parsed.pedidos[0].id, '12345', 'Test 3.3: Parsed order ID 12345');
  assertEqual(parsed.pedidos[0].itens.length, 2, 'Test 3.4: Parsed 2 item blocks');
  assertEqual(parsed.pedidos[0].itens[0].quantidade, 10, 'Test 3.5: Parsed item quantity 10');

  console.log(`\nTest Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
