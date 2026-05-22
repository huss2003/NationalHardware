CREATE POLICY "public read item_instances" ON public.item_instances FOR SELECT TO anon USING (true);
CREATE POLICY "public read item_history" ON public.item_history FOR SELECT TO anon USING (true);