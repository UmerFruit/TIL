create table challenges(
    id int primary key,
    title text,
    description text,
    category text,
    difficulty int,
    flag text,
    points int,     -- 1: info, 2: beginner, 3: easy, 4: medium, 5: advanced
    created_at text default current_timestamp, -- stores as ISO strings
    updated_at text default current_timestamp
);

insert into challenges (id, title, description, category, difficulty, flag, points) 
values 
(1, 'SQL Injection Basics', 'Learn the fundamentals of SQL injection vulnerabilities', 'Web', 1, 'flag{sqli_basics}', 100),
(2, 'XSS Challenge', 'Exploit cross-site scripting in a vulnerable application', 'Web', 2, 'flag{xss_challenge}', 200),
(3, 'Buffer Overflow', 'Perform a buffer overflow attack on a simple C program', 'Binary Exploitation', 3, 'flag{buf_overflow}', 300);
