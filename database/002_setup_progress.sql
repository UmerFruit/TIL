create table progress(
    id int primary key,
    challenge_id int not null,
    solved integer not null default 0,  -- boolean
    points integer not null,
    timestamp text default current_timestamp,
    foreign key(challenge_id) references challenge(id)
);

insert into progress(id, challenge_id, solved, points) values
(1, 101, 1, 100),
(2, 102, 0, 50),
(3, 103, 1, 75);
