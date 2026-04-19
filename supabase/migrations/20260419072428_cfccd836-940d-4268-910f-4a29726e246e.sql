UPDATE movie_projects SET 
  title = 'Phatty: Disgraceful in Bali',
  logline = 'Phatty, an Australian Rottweiler walking on two legs across a Bali street, drunk on Bintang with a surfboard under his arm, staggers into a bar fight.',
  full_script = 'NARRATOR (David Attenborough style): Behold, the Australian Rottweiler in his natural overseas habitat - Bali. Meet Phatty, a disgraceful specimen of Aussie tourism gone wrong. Phatty staggers across the Kuta street on two legs, a half-empty Bintang in one paw, a battered surfboard wedged under his other arm. He sways dangerously, grinning at confused locals. NARRATOR: Phatty has been drinking since breakfast. His Hawaiian shirt is unbuttoned. His sunglasses are crooked. He represents everything wrong with Australian tourists abroad. Phatty stumbles into a beachside bar, slams his Bintang on the counter, and demands another. A local patron bumps him. Phatty turns slowly, eyes narrowing. NARRATOR: And here we witness the inevitable - the Australian Rottweiler in confrontation mode. Phatty drops the surfboard. He raises his paws. The bar erupts into chaos as Phatty throws the first punch. Bottles fly. Tables overturn. Phatty is in his element. NARRATOR: Truly disgraceful. Truly Australian. Truly Phatty. Let this be a warning to Bali - lock up your Bintangs.',
  status = 'draft',
  last_error = NULL,
  error_count = 0
WHERE id = '9462c169-99db-4c32-9dff-222e43f1a517';

DELETE FROM movie_scenes WHERE project_id = '9462c169-99db-4c32-9dff-222e43f1a517';
DELETE FROM movie_character_bible WHERE project_id = '9462c169-99db-4c32-9dff-222e43f1a517';
DELETE FROM movie_render_jobs WHERE project_id = '9462c169-99db-4c32-9dff-222e43f1a517';