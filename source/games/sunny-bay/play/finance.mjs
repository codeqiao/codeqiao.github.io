export const LOAN_AMOUNT=500,LOAN_TOTAL=600,LOAN_PAYMENT=50;
export function loanPayment(debt){return Math.min(LOAN_PAYMENT,Math.max(0,Number.isFinite(debt)?debt:0))}
export function borrow(money,debt){
 if(loanPayment(debt)>0)return null;
 return {money:money+LOAN_AMOUNT,debt:LOAN_TOTAL};
}
export function settleLoan(money,debt){
 const payment=loanPayment(debt);
 return {money:money-payment,debt:Math.max(0,(Number.isFinite(debt)?debt:0)-payment),payment};
}
