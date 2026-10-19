import { describe, it, expect } from 'vitest';
import {
  parseTinyXml,
  extractItemSizeAndProduct,
  isApprovedOlistStatus
} from './olistService';

describe('olistService — Integração e Normalização Tiny / Olist', () => {
  it('deve extrair o tamanho e descrição a partir do título do produto e SKU', () => {
    const ext1 = extractItemSizeAndProduct('Camiseta Gola Redonda Dry Comfort Branco – G', 'CM-BRA-G');
    expect(ext1.size).toBe('G');

    const ext2 = extractItemSizeAndProduct('Camiseta Babylook Dry Comfort Azul – GG', 'CB-AZL-GG');
    expect(ext2.size).toBe('GG');

    const extG2 = extractItemSizeAndProduct('Camiseta Gola Redonda Dry Comfort Marrom - G2', 'CM-MAR-G2');
    expect(extG2.size).toBe('G2');

    const extG5 = extractItemSizeAndProduct('Camiseta Dry Comfort Preto - G5', 'CM-PRE-G5');
    expect(extG5.size).toBe('G5');

    const extInf2 = extractItemSizeAndProduct('Camiseta Infantil Azul - Tam 2', 'INF-AZL-2');
    expect(extInf2.size).toBe('2');

    const extInf10 = extractItemSizeAndProduct('Camiseta Infantil Azul - Tam 10', 'INF-AZL-10');
    expect(extInf10.size).toBe('10');

    const ext3 = extractItemSizeAndProduct('Uniforme Personalizado', 'UNI-P');
    expect(ext3.size).toBe('P');

    const ext4 = extractItemSizeAndProduct('Acessório Boné', 'ACC-001');
    expect(ext4.size).toBe('Tamanho não informado');
  });

  it('deve verificar corretamente os status aprovados de sincronização', () => {
    expect(isApprovedOlistStatus('Enviado')).toBe(true);
    expect(isApprovedOlistStatus('Aprovado')).toBe(true);
    expect(isApprovedOlistStatus('Faturado')).toBe(true);
    expect(isApprovedOlistStatus('Preparando envio')).toBe(true);
    expect(isApprovedOlistStatus('Pendente')).toBe(false);
    expect(isApprovedOlistStatus('Cancelado')).toBe(false);
  });

  it('deve efetuar o parsing do XML de retorno do Tiny ERP com sucesso', () => {
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
    expect(parsed.status).toBe('OK');
    expect(parsed.pedidos).toHaveLength(1);
    expect(parsed.pedidos[0].id).toBe('12345');
    expect(parsed.pedidos[0].itens).toHaveLength(2);
    expect(parsed.pedidos[0].itens[0].quantidade).toBe(10);
  });
});
