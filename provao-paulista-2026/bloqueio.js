/* Filtro de nomes ofensivos do ranking. O mesmo arquivo roda no navegador
 * (window.nomeBloqueado, carregado antes do app.js) e na função api/ranking.js (require).
 * Compara palavra inteira, para não barrar nomes comuns como "Paulo" ou "Pinto";
 * alguns radicais inequívocos também valem como começo de palavra e, os mais longos, com espaços entre as letras. */
(function (root) {
  "use strict";
  const PALAVRAS = [
    "porra", "caralho", "krl", "crl", "merda", "bosta", "puta", "puto", "putaria", "putinha", "foda", "fodase", "foda-se",
    "fdp", "pqp", "vsf", "vtnc", "tnc", "tmnc", "pnc", "cu", "cuzao", "cuzinho", "buceta", "boceta", "bucetinha", "bocetinha", "bct", "xoxota",
    "xereca", "piroca", "pica", "pau", "viado", "veado", "bicha", "traveco", "sapatao", "arrombado",
    "arrombada", "otario", "otaria", "babaca", "idiota", "imbecil", "retardado", "retardada", "mongol", "corno",
    "corna", "vagabundo", "vagabunda", "piranha", "vadia", "safado", "safada", "punheta", "siririca", "boquete",
    "chupa", "mamada", "macaco", "macaca", "nazi", "nazista", "hitler", "estupro", "estuprador", "pedofilo",
    "prostituta", "quenga", "kenga", "escroto", "escrota", "desgracado", "desgracada", "fuck", "shit", "bitch",
    "nigga", "nigger", "anal", "sexo", "porno", "xvideos", "teste", "admin",
  ];
  const RADICAIS = ["caralh", "arromb", "punhet", "buceta", "boceta", "estupr", "pedofil", "foder", "fuder", "fodid", "fudid", "putaria", "viadinh"];
  const JUNTOS = ["caralh", "arromb", "punhet", "buceta", "boceta", "estupr", "pedofil"]; // "p u n h e t a"
  const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };
  const set = new Set(PALAVRAS.map((p) => p.replace(/-/g, "")));
  const limpa = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[013457@$]/g, (c) => LEET[c]).replace(/(.)\1{2,}/g, "$1$1");
  function nomeBloqueado(nome) {
    const base = limpa(nome);
    const palavras = base.split(/[^a-z]+/).filter(Boolean);
    const comprimidas = palavras.map((p) => p.replace(/(.)\1+/g, "$1"));
    if (palavras.some((p, i) => set.has(p) || set.has(comprimidas[i]))) return true;
    if (palavras.some((p) => RADICAIS.some((r) => p.startsWith(r)))) return true;
    const junto = base.replace(/[^a-z]/g, "");
    return JUNTOS.some((r) => junto.includes(r));
  }
  if (typeof module !== "undefined" && module.exports) module.exports = nomeBloqueado;
  else root.nomeBloqueado = nomeBloqueado;
})(this);
