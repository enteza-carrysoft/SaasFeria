import { redirect } from 'next/navigation';

/**
 * El registro público está deshabilitado.
 * Las cuentas de socios las crea el gestor desde /admin/staff.
 */
export default function RegisterPage() {
    redirect('/login');
}
