UPDATE public.living_gifs
SET status='queued',
    attempts=0,
    locked_at=NULL,
    locked_by=NULL,
    runway_task_id=NULL,
    replicate_prediction_id=NULL,
    pipeline_stage=NULL,
    error_message=NULL,
    updated_at=now()
WHERE id='9a505bd8-9bb1-403a-8079-0cab27808337';