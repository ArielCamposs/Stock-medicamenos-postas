-- Paso 1/2: solo agregar el valor al enum (debe confirmarse antes de usarlo en constraints/RLS).
-- El resto está en 20260602160100_role_bodega_farmacia_policies.sql

alter type public.role_user add value if not exists 'BODEGA_FARMACIA';
