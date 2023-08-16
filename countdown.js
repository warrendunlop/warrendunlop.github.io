const main = () => {
    const second = 1000
    const minute = second * 60
    const hour = minute * 60
    const day = hour * 24
        
    //INSERT EVENT DATE AND TIME HERE IN THIS FORMAT: 'June 1, 2023, 19:00:00'
    const EVENTDATE = new Date('Oct 1, 2023, 21:00:00')
   
    const countDown = new Date(EVENTDATE).getTime()
    const x = setInterval(() => {
  
          const now = new Date().getTime()
          const distance = countDown - now
  
          document.getElementById("days").innerText = Math.floor(distance / day)
          document.getElementById("hours").innerText = Math.floor((distance % day) / (hour))
          document.getElementById("minutes").innerText = Math.floor((distance % hour) / (minute))
          document.getElementById("seconds").innerText = Math.floor((distance % minute) / second)
  
        //delay in milliseconds
        }, 0)
    }
  
  main();