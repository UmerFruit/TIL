-- One row per solved challenge. Challenge ids are the string ids from content/.
create table if not exists progress(
    challenge_id text primary key,
    points integer not null,
    solved_at text not null default current_timestamp
);
