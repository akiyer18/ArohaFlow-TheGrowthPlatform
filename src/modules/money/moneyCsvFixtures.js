/**
 * Synthetic NL bank CSV shapes for tests only — not real statements.
 * Never commit real bank exports.
 */

export const FIXTURE_ING_CSV = `Datum;Naam / Omschrijving;Rekening;Tegenrekening;Code;Af Bij;Bedrag (EUR);Mutatiesoort;Mededelingen
2026-11-03;Albert Heijn;NL00INGB0000000001;NL00AH0000000001;IC;Af;12,50;Betaalautomaat;Boodschappen
2026-11-04;Salaris Acme;NL00INGB0000000001;NL00ACME000000001;GT;Bij;2500,00;Online bankieren;November salary
2026-11-05;Overboeking Spaarrekening;NL00INGB0000000001;NL00INGB0000000002;GT;Af;100,00;Online bankieren;Eigen rekening
`;

export const FIXTURE_ABN_CSV = `accountNumber,mutationcode,transactiondate,valuedate,startsaldo,endsaldo,amount,description
NL00ABNA0000000001,pm,20261106,20261106,1000.00,970.00,-30.00,Albert Heijn Amsterdam
NL00ABNA0000000001,bg,20261107,20261107,970.00,2970.00,2000.00,Salaris
NL00ABNA0000000001,gt,20261108,20261108,2970.00,2770.00,-200.00,Overboeking naar spaarrekening
`;

export const FIXTURE_RABO_CSV = `IBAN/BBAN,Munt,BIC,Volgnr,Datum,Rentedatum,Bedrag,Saldo na trn,Tegenrekening IBAN/BBAN,Naam tegenpartij,Omschrijving-1
NL00RABO0000000001,EUR,RABONL2U,1,2026-11-09,2026-11-09,-18.75,500.00,NL00AH0000000002,Albert Heijn,Boodschappen
NL00RABO0000000001,EUR,RABONL2U,2,2026-11-10,2026-11-10,1800.00,2300.00,NL00PAYR000000001,Payroll Co,Salaris
NL00RABO0000000001,EUR,RABONL2U,3,2026-11-11,2026-11-11,-50.00,2250.00,NL00RABO0000000002,Spaarrekening,Interne overboeking
`;

export function fixtureFile(csvText, fileName) {
  return new File([csvText], fileName, { type: 'text/csv' });
}
